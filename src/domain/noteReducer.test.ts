import { describe, expect, it } from 'vitest';
import { bringToFront, notesReducer, nextZIndex } from './noteReducer';
import type { Note } from './types';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    x: 200,
    y: 150,
    width: 200,
    height: 160,
    text: 'hello',
    color: 'yellow',
    zIndex: 1,
    ...overrides,
  };
}

describe('notesReducer', () => {
  it('creates a note with the provided geometry and id', () => {
    const created = note();
    const state = notesReducer([], { type: 'create', note: created });
    expect(state).toEqual([created]);
    expect(state[0]?.id).toBe('n1');
  });

  it('moves only the targeted note and preserves the other object', () => {
    const first = note();
    const second = note({ id: 'n2', x: 40, y: 40, zIndex: 2 });
    const state = [first, second];
    const next = notesReducer(state, { type: 'move', id: 'n1', x: 210, y: 160 });
    expect(next[0]).toEqual({ ...first, x: 210, y: 160 });
    expect(next[1]).toBe(second);
    expect(notesReducer(state, { type: 'move', id: 'missing', x: 1, y: 1 })).toBe(state);
    expect(notesReducer(state, { type: 'move', id: 'n1', x: 200, y: 150 })).toBe(state);
  });

  it('resizes only the targeted note', () => {
    const first = note();
    const second = note({ id: 'n2', zIndex: 2 });
    const state = [first, second];
    const next = notesReducer(state, { type: 'resize', id: 'n2', width: 180, height: 140 });
    expect(next[0]).toBe(first);
    expect(next[1]).toEqual({ ...second, width: 180, height: 140 });
  });

  it('deletes one note and ignores an unknown id', () => {
    const first = note();
    const second = note({ id: 'n2' });
    const state = [first, second];
    expect(notesReducer(state, { type: 'delete', id: 'n1' })).toEqual([second]);
    expect(notesReducer(state, { type: 'delete', id: 'missing' })).toBe(state);
  });

  it('applies two commands to distinct notes without dropping either', () => {
    const first = note();
    const second = note({ id: 'n2', zIndex: 2 });
    const third = note({ id: 'n3', zIndex: 3, text: 'keep' });
    let state = [first, second, third];
    state = notesReducer(state, { type: 'move', id: 'n1', x: 10, y: 12 });
    state = notesReducer(state, { type: 'resize', id: 'n2', width: 150, height: 120 });
    expect(state.map((item) => item.id)).toEqual(['n1', 'n2', 'n3']);
    expect(state[0]).toMatchObject({ x: 10, y: 12 });
    expect(state[1]).toMatchObject({ width: 150, height: 120 });
    expect(state[2]).toBe(third);
  });

  it('updates text and color only when the value changes', () => {
    const current = note();
    const state = [current];
    expect(notesReducer(state, { type: 'updateText', id: 'n1', text: 'hello' })).toBe(state);
    expect(notesReducer(state, { type: 'updateText', id: 'n1', text: 'next' })[0]?.text).toBe(
      'next',
    );
    expect(notesReducer(state, { type: 'setColor', id: 'n1', color: 'mint' })[0]?.color).toBe(
      'mint',
    );
  });

  it('brings a note to a bounded front z-index and leaves a dense top note untouched', () => {
    const back = note({ id: 'back', zIndex: 1 });
    const front = note({ id: 'front', zIndex: 2 });
    const state = [back, front];
    expect(bringToFront(state, 'front')).toBe(state);
    const raised = bringToFront(state, 'back');
    expect(raised.map((item) => [item.id, item.zIndex])).toEqual([
      ['back', 2],
      ['front', 1],
    ]);
    expect(nextZIndex(raised)).toBe(3);
    expect(bringToFront(state, 'missing')).toBe(state);
  });
});
