import { useEffect, useRef } from 'react';
import { TEXT_SAVE_DELAY_MS } from '../domain/constants';
import type { Note } from '../domain/types';
import { getBrowserStorage, saveNotes } from './noteStorage';

function structuralKey(notes: readonly Note[]): string {
  return JSON.stringify(
    notes.map((note) => ({
      id: note.id,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      color: note.color,
      zIndex: note.zIndex,
    })),
  );
}

function textKey(notes: readonly Note[]): string {
  return JSON.stringify(notes.map((note) => note.text));
}

export function useNotePersistence(
  notes: readonly Note[],
  enabled: boolean,
  onStatus: (message: string | null) => void,
): void {
  const previous = useRef<{ structural: string; text: string } | null>(null);
  const timer = useRef<number | null>(null);
  const notesRef = useRef(notes);
  const onStatusRef = useRef(onStatus);

  useEffect(() => {
    notesRef.current = notes;
    onStatusRef.current = onStatus;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const structural = structuralKey(notes);
    const text = textKey(notes);
    if (previous.current === null) {
      previous.current = { structural, text };
      return undefined;
    }

    const structuralChanged = previous.current.structural !== structural;
    const textChanged = previous.current.text !== text;
    previous.current = { structural, text };
    if (!structuralChanged && !textChanged) return undefined;

    const persist = () => {
      timer.current = null;
      const storage = getBrowserStorage();
      if (!storage) {
        onStatusRef.current('Browser storage is unavailable. Notes will not be saved.');
        return;
      }
      const result = saveNotes(storage, notesRef.current);
      onStatusRef.current(result.ok ? null : result.message);
    };

    if (structuralChanged) {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      persist();
      return undefined;
    }

    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(persist, TEXT_SAVE_DELAY_MS);
    return undefined;
  }, [enabled, notes]);

  useEffect(() => {
    if (!enabled) return undefined;
    return () => {
      if (timer.current === null) return;
      window.clearTimeout(timer.current);
      timer.current = null;
      const storage = getBrowserStorage();
      if (storage) saveNotes(storage, notesRef.current);
    };
  }, [enabled]);
}
