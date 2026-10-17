import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { STORAGE_KEY } from '../persistence/noteStorage';

function pointerInit(clientX: number, clientY: number) {
  return { pointerId: 1, clientX, clientY, button: 0, isPrimary: true, bubbles: true };
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a note at the exact requested board geometry', () => {
    render(<App />);
    expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    const note = document.querySelector('article');
    expect(note).not.toBeNull();
    expect(note).toHaveAttribute('data-x', '48');
    expect(note).toHaveAttribute('data-y', '48');
    expect(note).toHaveAttribute('data-width', '220');
    expect(note).toHaveAttribute('data-height', '160');
    expect(screen.queryByText(/No notes yet/)).not.toBeInTheDocument();
  });

  it('rejects an invalid size and does not create a shifted note', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 120/i);
    expect(document.querySelector('article')).toBeNull();
  });

  it('restores saved notes and does not write storage during a drag preview', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    const writesAfterCreate = setItem.mock.calls.length;
    expect(writesAfterCreate).toBeGreaterThan(0);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Drag note' }), pointerInit(0, 0));
    fireEvent.pointerMove(window, pointerInit(40, 30));
    expect(setItem.mock.calls.length).toBe(writesAfterCreate);

    fireEvent.pointerUp(window, pointerInit(40, 30));
    expect(setItem.mock.calls.length).toBeGreaterThan(writesAfterCreate);
    const note = document.querySelector('article');
    expect(note).toHaveAttribute('data-x', '88');
    expect(note).toHaveAttribute('data-y', '78');

    view.unmount();
    setItem.mockRestore();
    render(<App />);
    expect(document.querySelector('article')).toHaveAttribute('data-x', '88');
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('');
  });

  it('ignores corrupt storage and brings a note forward when its text is selected', () => {
    localStorage.setItem(STORAGE_KEY, '{');
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(/unreadable/i);
    expect(document.querySelector('article')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    const notes = document.querySelectorAll('article');
    expect(notes[0]).toHaveAttribute('data-z', '1');
    expect(notes[1]).toHaveAttribute('data-z', '2');

    const textboxes = screen.getAllByRole('textbox', { name: 'Note text' });
    fireEvent.pointerDown(textboxes[0]);
    expect(document.querySelector('article[data-x="48"]')).toHaveAttribute('data-z', '2');
    expect(document.querySelector('article[data-x="300"]')).toHaveAttribute('data-z', '1');
  });
});
