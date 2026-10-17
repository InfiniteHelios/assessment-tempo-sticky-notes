import { describe, expect, it } from 'vitest';
import type { Note } from '../domain/types';
import { loadNotes, saveNotes, SCHEMA_VERSION, STORAGE_KEY } from './noteStorage';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    x: 48,
    y: 48,
    width: 220,
    height: 160,
    text: 'Keep me',
    color: 'sky',
    zIndex: 1,
    ...overrides,
  };
}

function memoryStorage(initial?: string): Storage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(STORAGE_KEY, initial);
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('noteStorage', () => {
  it('round-trips committed notes and stable ids', () => {
    const storage = memoryStorage();
    const notes = [note(), note({ id: 'n2', x: 80, text: 'Second', color: 'pink', zIndex: 2 })];
    expect(saveNotes(storage, notes)).toEqual({ ok: true });
    expect(loadNotes(storage)).toEqual({ status: 'ok', notes });
  });

  it('returns empty when nothing is stored', () => {
    expect(loadNotes(memoryStorage())).toEqual({ status: 'empty' });
  });

  it('falls back when JSON, schema, geometry, or ids are invalid', () => {
    expect(loadNotes(memoryStorage('{')).status).toBe('invalid');
    expect(loadNotes(memoryStorage(JSON.stringify({ version: 99, notes: [] }))).status).toBe(
      'invalid',
    );
    expect(
      loadNotes(
        memoryStorage(
          JSON.stringify({
            version: SCHEMA_VERSION,
            notes: [note({ width: 10 })],
          }),
        ),
      ).status,
    ).toBe('invalid');
    const duplicates = loadNotes(
      memoryStorage(
        JSON.stringify({
          version: SCHEMA_VERSION,
          notes: [note(), note()],
        }),
      ),
    );
    expect(duplicates.status).toBe('invalid');
    if (duplicates.status === 'invalid') {
      expect(duplicates.message).toMatch(/duplicate/i);
    }
  });

  it('keeps a note that sits past the minimum board and rejects one past the storage cap', () => {
    const storage = memoryStorage();
    const wide = note({ x: 1800, y: 40 });
    expect(saveNotes(storage, [wide])).toEqual({ ok: true });
    expect(loadNotes(storage)).toEqual({ status: 'ok', notes: [wide] });
    expect(
      loadNotes(
        memoryStorage(
          JSON.stringify({
            version: SCHEMA_VERSION,
            notes: [note({ x: 19900, width: 220 })],
          }),
        ),
      ).status,
    ).toBe('invalid');
  });

  it('reports unavailable storage and quota failures', () => {
    const brokenRead: Storage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadNotes(brokenRead).status).toBe('unavailable');

    const brokenWrite: Storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveNotes(brokenWrite, [note()]).ok).toBe(false);
  });
});
