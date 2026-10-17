import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
} from './constants';
import type { CreateGeometryInput, NoteGeometry } from './types';

export type BoardSize = {
  width: number;
  height: number;
};

export const MINIMUM_BOARD_SIZE: BoardSize = {
  width: BOARD_WIDTH,
  height: BOARD_HEIGHT,
};

function positiveSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The board covers the visible canvas. It never starts smaller than 1600 by 1000,
 * and it stays large enough for notes that already extend past the viewport.
 */
export function boardSizeForViewport(
  viewport: { width: number; height: number },
  notes: readonly Pick<NoteGeometry, 'x' | 'y' | 'width' | 'height'>[] = [],
): BoardSize {
  let width = Math.max(BOARD_WIDTH, positiveSize(viewport.width));
  let height = Math.max(BOARD_HEIGHT, positiveSize(viewport.height));
  for (const note of notes) {
    width = Math.max(width, note.x + note.width);
    height = Math.max(height, note.y + note.height);
  }
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
  };
}

export type Point = {
  x: number;
  y: number;
};

export type AxisRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type GestureOrigin = {
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
  initial: NoteGeometry;
};

export type PointerSample = {
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
};

export type ValidationResult = { ok: true } | { ok: false; message: string };

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function validateCreateGeometry(
  input: CreateGeometryInput,
  board: BoardSize = MINIMUM_BOARD_SIZE,
): ValidationResult {
  const fields: Array<[string, number]> = [
    ['X', input.x],
    ['Y', input.y],
    ['Width', input.width],
    ['Height', input.height],
  ];

  for (const [label, value] of fields) {
    if (!Number.isFinite(value)) {
      return { ok: false, message: `${label} must be a finite number.` };
    }
  }

  if (input.width < MIN_NOTE_WIDTH || input.height < MIN_NOTE_HEIGHT) {
    return {
      ok: false,
      message: `Width must be at least ${MIN_NOTE_WIDTH} and height at least ${MIN_NOTE_HEIGHT}.`,
    };
  }

  const insideBoard =
    input.x >= 0 &&
    input.y >= 0 &&
    input.x + input.width <= board.width &&
    input.y + input.height <= board.height;

  if (!insideBoard) {
    return {
      ok: false,
      message: `The note must fit inside the ${board.width} by ${board.height} board. The requested position was not changed.`,
    };
  }

  return { ok: true };
}

export function clampNotePosition(
  x: number,
  y: number,
  width: number,
  height: number,
  board: BoardSize = MINIMUM_BOARD_SIZE,
): Pick<NoteGeometry, 'x' | 'y'> {
  return {
    x: clamp(x, 0, board.width - width),
    y: clamp(y, 0, board.height - height),
  };
}

export function clampNoteSize(
  x: number,
  y: number,
  width: number,
  height: number,
  board: BoardSize = MINIMUM_BOARD_SIZE,
): Pick<NoteGeometry, 'width' | 'height'> {
  return {
    width: clamp(width, MIN_NOTE_WIDTH, board.width - x),
    height: clamp(height, MIN_NOTE_HEIGHT, board.height - y),
  };
}

/**
 * Board-local movement is the pointer's client delta plus the board's scroll delta.
 * Scroll is included so a wheel-scroll during a drag does not leave the note behind the cursor.
 */
export function pointerAndScrollDelta(
  origin: GestureOrigin,
  sample: PointerSample,
): { dx: number; dy: number } {
  return {
    dx: sample.clientX - origin.startClientX + (sample.scrollLeft - origin.startScrollLeft),
    dy: sample.clientY - origin.startClientY + (sample.scrollTop - origin.startScrollTop),
  };
}

/**
 * Drag preview is not clamped. The pointer has to be able to reach a trash zone that
 * sits on the viewport corner, past the board edge, and the note follows that pointer.
 * The committed position is clamped separately when the note is not deleted.
 */
export function resolveDragGeometry(origin: GestureOrigin, sample: PointerSample): NoteGeometry {
  const { dx, dy } = pointerAndScrollDelta(origin, sample);
  return {
    x: origin.initial.x + dx,
    y: origin.initial.y + dy,
    width: origin.initial.width,
    height: origin.initial.height,
  };
}

/** Keep the trash inset on the visible corner of the board, not in the empty margin past it. */
export function trashViewportOffset(
  frame: AxisRect,
  board: AxisRect,
  inset = 16,
): { right: number; bottom: number } {
  const visibleRight = Math.min(frame.right, board.right);
  const visibleBottom = Math.min(frame.bottom, board.bottom);
  return {
    right: Math.max(inset, frame.right - visibleRight + inset),
    bottom: Math.max(inset, frame.bottom - visibleBottom + inset),
  };
}

export function resolveResizeGeometry(
  origin: GestureOrigin,
  sample: PointerSample,
  board: BoardSize = MINIMUM_BOARD_SIZE,
): NoteGeometry {
  const { dx, dy } = pointerAndScrollDelta(origin, sample);
  const size = clampNoteSize(
    origin.initial.x,
    origin.initial.y,
    origin.initial.width + dx,
    origin.initial.height + dy,
    board,
  );
  return {
    x: origin.initial.x,
    y: origin.initial.y,
    ...size,
  };
}

export function resolveGestureGeometry(
  mode: 'dragging' | 'resizing',
  origin: GestureOrigin,
  sample: PointerSample,
  board: BoardSize = MINIMUM_BOARD_SIZE,
): NoteGeometry {
  return mode === 'dragging'
    ? resolveDragGeometry(origin, sample)
    : resolveResizeGeometry(origin, sample, board);
}

export function isPointerOverTrash(pointer: Point, trashRect: AxisRect): boolean {
  return (
    pointer.x >= trashRect.left &&
    pointer.x <= trashRect.right &&
    pointer.y >= trashRect.top &&
    pointer.y <= trashRect.bottom
  );
}

