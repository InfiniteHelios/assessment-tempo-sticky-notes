import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH, MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH } from './constants';
import {
  boardSizeForViewport,
  clampNotePosition,
  isPointerOverTrash,
  resolveDragGeometry,
  resolveResizeGeometry,
  trashViewportOffset,
  validateCreateGeometry,
  type GestureOrigin,
} from './geometry';

const origin: GestureOrigin = {
  startClientX: 10,
  startClientY: 20,
  startScrollLeft: 0,
  startScrollTop: 0,
  initial: { x: 200, y: 150, width: 200, height: 160 },
};

describe('validateCreateGeometry', () => {
  it('accepts an exact in-board rectangle', () => {
    expect(validateCreateGeometry({ x: 0, y: 0, width: 120, height: 96 })).toEqual({ ok: true });
    expect(
      validateCreateGeometry({
        x: BOARD_WIDTH - 120,
        y: BOARD_HEIGHT - 96,
        width: 120,
        height: 96,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects non-finite, too-small, and out-of-board values without changing them', () => {
    expect(validateCreateGeometry({ x: Number.NaN, y: 0, width: 120, height: 96 }).ok).toBe(false);
    expect(validateCreateGeometry({ x: 0, y: -1, width: 120, height: 96 }).ok).toBe(false);
    expect(validateCreateGeometry({ x: 0, y: 0, width: MIN_NOTE_WIDTH - 1, height: 96 }).ok).toBe(
      false,
    );
    expect(
      validateCreateGeometry({ x: 0, y: 0, width: 120, height: MIN_NOTE_HEIGHT - 1 }).ok,
    ).toBe(false);
    const outside = validateCreateGeometry({ x: 1500, y: 0, width: 200, height: 96 });
    expect(outside.ok).toBe(false);
    if (!outside.ok) {
      expect(outside.message).toMatch(/not changed/i);
    }
  });
});

describe('gesture geometry', () => {
  it('moves from the initial snapshot plus pointer and scroll deltas', () => {
    const moved = resolveDragGeometry(origin, {
      clientX: 20,
      clientY: 25,
      scrollLeft: 80,
      scrollTop: 0,
    });
    expect(moved).toEqual({ x: 290, y: 155, width: 200, height: 160 });
  });

  it('follows the pointer past the board so a drag can reach the trash', () => {
    const moved = resolveDragGeometry(origin, {
      clientX: 5000,
      clientY: 5000,
      scrollLeft: 0,
      scrollTop: 0,
    });
    expect(moved).toEqual({
      x: origin.initial.x + 4990,
      y: origin.initial.y + 4980,
      width: origin.initial.width,
      height: origin.initial.height,
    });
  });

  it('clamps a released note back onto the board', () => {
    expect(clampNotePosition(5000, 5000, 200, 160)).toEqual({
      x: BOARD_WIDTH - 200,
      y: BOARD_HEIGHT - 160,
    });
  });

  it('clamps resize to the minimum size and keeps the origin', () => {
    const resized = resolveResizeGeometry(origin, {
      clientX: origin.startClientX - 500,
      clientY: origin.startClientY - 500,
      scrollLeft: 0,
      scrollTop: 0,
    });
    expect(resized).toEqual({
      x: 200,
      y: 150,
      width: MIN_NOTE_WIDTH,
      height: MIN_NOTE_HEIGHT,
    });
  });

  it('clamps resize so the note stays inside the board', () => {
    const edge: GestureOrigin = {
      ...origin,
      initial: { x: 1400, y: 800, width: 120, height: 96 },
    };
    const resized = resolveResizeGeometry(edge, {
      clientX: edge.startClientX + 500,
      clientY: edge.startClientY + 500,
      scrollLeft: 0,
      scrollTop: 0,
    });
    expect(resized).toEqual({ x: 1400, y: 800, width: 200, height: 200 });
  });
});

describe('board size', () => {
  it('keeps the minimum board when the viewport is smaller', () => {
    expect(boardSizeForViewport({ width: 1024, height: 700 })).toEqual({
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
    });
  });

  it('grows either edge when the viewport is larger', () => {
    expect(boardSizeForViewport({ width: 1920, height: 700 })).toEqual({
      width: 1920,
      height: BOARD_HEIGHT,
    });
    expect(boardSizeForViewport({ width: 800, height: 1200 })).toEqual({
      width: BOARD_WIDTH,
      height: 1200,
    });
  });

  it('stays large enough for a note that extends past the viewport', () => {
    expect(
      boardSizeForViewport({ width: 900, height: 700 }, [
        { x: 1800, y: 40, width: 220, height: 160 },
      ]),
    ).toEqual({ width: 2020, height: BOARD_HEIGHT });
  });
});

describe('trash hit testing', () => {
  const trash = { left: 100, top: 200, right: 196, bottom: 296 };

  it('treats the whole trash rectangle, including every edge, as the pointer target', () => {
    expect(isPointerOverTrash({ x: 100, y: 200 }, trash)).toBe(true);
    expect(isPointerOverTrash({ x: 196, y: 200 }, trash)).toBe(true);
    expect(isPointerOverTrash({ x: 100, y: 296 }, trash)).toBe(true);
    expect(isPointerOverTrash({ x: 196, y: 296 }, trash)).toBe(true);
    expect(isPointerOverTrash({ x: 148, y: 248 }, trash)).toBe(true);
    expect(isPointerOverTrash({ x: 99, y: 248 }, trash)).toBe(false);
    expect(isPointerOverTrash({ x: 197, y: 248 }, trash)).toBe(false);
    expect(isPointerOverTrash({ x: 148, y: 199 }, trash)).toBe(false);
    expect(isPointerOverTrash({ x: 148, y: 297 }, trash)).toBe(false);
  });

  it('keeps the trash on the visible board corner when the board is narrower than the window', () => {
    const frame = { left: 0, top: 70, right: 1920, bottom: 1080 };
    const board = { left: 0, top: 70, right: 1600, bottom: 1070 };
    expect(trashViewportOffset(frame, board)).toEqual({ right: 336, bottom: 26 });
  });

  it('pins the trash to the viewport corner when the board fills the window', () => {
    const frame = { left: 0, top: 70, right: 1024, bottom: 768 };
    const board = { left: 0, top: 70, right: 1600, bottom: 1070 };
    expect(trashViewportOffset(frame, board)).toEqual({ right: 16, bottom: 16 });
  });
});
