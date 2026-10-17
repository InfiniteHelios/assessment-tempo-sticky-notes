import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEXT_SAVE_DELAY_MS } from '../domain/constants';
import type { Note } from '../domain/types';
import { STORAGE_KEY } from './noteStorage';
import { useNotePersistence } from './useNotePersistence';

function note(text: string, x = 48): Note {
  return {
    id: 'n1',
    x,
    y: 48,
    width: 220,
    height: 160,
    text,
    color: 'yellow',
    zIndex: 1,
  };
}

function Probe({ notes }: { notes: Note[] }) {
  const [status, setStatus] = useState<string | null>(null);
  useNotePersistence(notes, true, setStatus);
  return <p role="status">{status ?? 'ready'}</p>;
}

describe('useNotePersistence', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves a move immediately and debounces text edits', () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<Probe notes={[note('first')]} />);
    expect(setItem).not.toHaveBeenCalled();

    view.rerender(<Probe notes={[note('first edited')]} />);
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TEXT_SAVE_DELAY_MS);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('first edited');

    setItem.mockClear();
    view.rerender(<Probe notes={[note('first edited', 80)]} />);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('ready');
  });
});
