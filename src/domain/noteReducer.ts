import type { Note, NoteColor } from './types';

export type NoteAction =
  | { type: 'create'; note: Note }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resize'; id: string; width: number; height: number }
  | { type: 'delete'; id: string }
  | { type: 'updateText'; id: string; text: string }
  | { type: 'setColor'; id: string; color: NoteColor }
  | { type: 'bringToFront'; id: string };

function replaceNote(state: Note[], index: number, note: Note): Note[] {
  const next = state.slice();
  next[index] = note;
  return next;
}

export function nextZIndex(notes: readonly Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.zIndex), 0) + 1;
}

/** Keep z-order dense (1..n) and move the selected note to the top. Unchanged notes keep identity. */
export function bringToFront(state: Note[], id: string): Note[] {
  const currentIndex = state.findIndex((note) => note.id === id);
  if (currentIndex < 0) return state;

  const ordered = state
    .map((note, index) => ({ note, index }))
    .sort((a, b) => a.note.zIndex - b.note.zIndex || a.index - b.index);

  const alreadyTop = ordered[ordered.length - 1]?.note.id === id;
  const dense = ordered.every((entry, position) => entry.note.zIndex === position + 1);
  if (alreadyTop && dense) return state;

  const sequence = [
    ...ordered.filter((entry) => entry.note.id !== id).map((entry) => entry.note),
    state[currentIndex],
  ];

  let changed = false;
  const nextById = new Map<string, Note>();
  sequence.forEach((note, position) => {
    const zIndex = position + 1;
    if (note.zIndex === zIndex) {
      nextById.set(note.id, note);
      return;
    }
    changed = true;
    nextById.set(note.id, { ...note, zIndex });
  });

  if (!changed) return state;
  return state.map((note) => nextById.get(note.id) ?? note);
}

export function notesReducer(state: Note[], action: NoteAction): Note[] {
  switch (action.type) {
    case 'create':
      return [...state, action.note];
    case 'move': {
      const index = state.findIndex((note) => note.id === action.id);
      if (index < 0) return state;
      const current = state[index];
      if (current.x === action.x && current.y === action.y) return state;
      return replaceNote(state, index, { ...current, x: action.x, y: action.y });
    }
    case 'resize': {
      const index = state.findIndex((note) => note.id === action.id);
      if (index < 0) return state;
      const current = state[index];
      if (current.width === action.width && current.height === action.height) return state;
      return replaceNote(state, index, {
        ...current,
        width: action.width,
        height: action.height,
      });
    }
    case 'delete': {
      const next = state.filter((note) => note.id !== action.id);
      return next.length === state.length ? state : next;
    }
    case 'updateText': {
      const index = state.findIndex((note) => note.id === action.id);
      if (index < 0) return state;
      const current = state[index];
      if (current.text === action.text) return state;
      return replaceNote(state, index, { ...current, text: action.text });
    }
    case 'setColor': {
      const index = state.findIndex((note) => note.id === action.id);
      if (index < 0) return state;
      const current = state[index];
      if (current.color === action.color) return state;
      return replaceNote(state, index, { ...current, color: action.color });
    }
    case 'bringToFront':
      return bringToFront(state, action.id);
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}
