import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ACTIVE_NOTE_Z_INDEX } from '../domain/constants';
import type { Note } from '../domain/types';
import { StickyNote } from './StickyNote';

const note: Note = {
  id: 'n1',
  x: 48,
  y: 64,
  width: 220,
  height: 160,
  text: 'Plan the demo',
  color: 'yellow',
  zIndex: 2,
};

describe('StickyNote', () => {
  it('does not start a drag from the text field or the resize handle', () => {
    const onDragPointerDown = vi.fn();
    const onResizePointerDown = vi.fn();
    const onSelect = vi.fn();
    render(
      <StickyNote
        note={note}
        frame={note}
        active={false}
        onDragPointerDown={onDragPointerDown}
        onResizePointerDown={onResizePointerDown}
        onChangeText={vi.fn()}
        onChangeColor={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Note text' }));
    expect(onDragPointerDown).not.toHaveBeenCalled();
    expect(onResizePointerDown).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Resize note' }));
    expect(onDragPointerDown).not.toHaveBeenCalled();
    expect(onResizePointerDown).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'mint color' }));
    expect(onDragPointerDown).not.toHaveBeenCalled();
  });

  it('stacks an active note above its stored z-index', () => {
    const { container } = render(
      <StickyNote
        note={{ ...note, zIndex: 80 }}
        frame={note}
        active
        onDragPointerDown={vi.fn()}
        onResizePointerDown={vi.fn()}
        onChangeText={vi.fn()}
        onChangeColor={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector('article')).toHaveStyle({ zIndex: String(ACTIVE_NOTE_Z_INDEX) });
  });

  it('renders note text as a value, not markup', () => {
    render(
      <StickyNote
        note={{ ...note, text: '<b>safe</b>' }}
        frame={note}
        active={false}
        onDragPointerDown={vi.fn()}
        onResizePointerDown={vi.fn()}
        onChangeText={vi.fn()}
        onChangeColor={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('<b>safe</b>');
    expect(screen.queryByText('safe', { selector: 'b' })).not.toBeInTheDocument();
  });
});
