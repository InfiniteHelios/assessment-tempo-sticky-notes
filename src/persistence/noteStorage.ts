import { MAX_STORED_BOARD_EDGE, MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH } from '../domain/constants';
import { isNoteColor, type Note } from '../domain/types';

export const STORAGE_KEY = 'tempo-sticky-notes';
export const SCHEMA_VERSION = 1;

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; notes: Note[] }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; message: string };

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) return null;
  if (typeof record.text !== 'string') return null;
  if (!isNoteColor(record.color)) return null;
  if (
    !isFiniteNumber(record.x) ||
    !isFiniteNumber(record.y) ||
    !isFiniteNumber(record.width) ||
    !isFiniteNumber(record.height) ||
    !isFiniteNumber(record.zIndex)
  ) {
    return null;
  }
  if (record.width < MIN_NOTE_WIDTH || record.height < MIN_NOTE_HEIGHT) return null;
  if (record.x < 0 || record.y < 0) return null;
  if (
    record.x + record.width > MAX_STORED_BOARD_EDGE ||
    record.y + record.height > MAX_STORED_BOARD_EDGE
  ) {
    return null;
  }

  return {
    id: record.id,
    x: record.x,
    y: record.y,
    width: record.width,
    height: record.height,
    text: record.text,
    color: record.color,
    zIndex: record.zIndex,
  };
}

export function loadNotes(storage: StorageReader): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      status: 'unavailable',
      message: 'Browser storage is unavailable. Notes will not be saved.',
    };
  }

  if (raw === null || raw.trim() === '') return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', message: 'Saved notes were unreadable and were ignored.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { status: 'invalid', message: 'Saved notes used an unsupported format and were ignored.' };
  }

  const record = parsed as Record<string, unknown>;
  if (record.version !== SCHEMA_VERSION || !Array.isArray(record.notes)) {
    return { status: 'invalid', message: 'Saved notes used an unsupported format and were ignored.' };
  }

  const notes: Note[] = [];
  for (const item of record.notes) {
    const note = readNote(item);
    if (!note) {
      return { status: 'invalid', message: 'Saved notes failed validation and were ignored.' };
    }
    notes.push(note);
  }

  const ids = new Set(notes.map((note) => note.id));
  if (ids.size !== notes.length) {
    return { status: 'invalid', message: 'Saved notes contained duplicate ids and were ignored.' };
  }

  return { status: 'ok', notes };
}

export function saveNotes(
  storage: StorageWriter,
  notes: readonly Note[],
): { ok: true } | { ok: false; message: string } {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        notes,
      }),
    );
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not save notes. Storage may be disabled or full.' };
  }
}

export function getBrowserStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}
