import { act, fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../domain/constants';
import { MINIMUM_BOARD_SIZE, type AxisRect } from '../domain/geometry';
import { notesReducer } from '../domain/noteReducer';
import type { Note } from '../domain/types';
import { useNoteInteraction } from './useNoteInteraction';

const trashAtStart: AxisRect = { left: 290, top: 220, right: 320, bottom: 250 };

function sampleNote(): Note {
  return {
    id: 'n1',
    x: 200,
    y: 150,
    width: 200,
    height: 160,
    text: '',
    color: 'yellow',
    zIndex: 1,
  };
}

function pointerInit(pointerId: number, clientX: number, clientY: number) {
  return { pointerId, clientX, clientY, button: 0, isPrimary: true, bubbles: true };
}

function Harness({
  scroll,
  trash,
}: {
  scroll: { scrollLeft: number; scrollTop: number };
  trash: AxisRect | null;
}) {
  const [notes, dispatch] = useReducer(notesReducer, [sampleNote()]);
  const interaction = useNoteInteraction({
    dispatch,
    getScroll: () => scroll,
    hasBoard: () => true,
    getBoardSize: () => MINIMUM_BOARD_SIZE,
    getTrashRect: () => trash,
  });
  const note = notes.find((item) => item.id === 'n1');

  return (
    <div>
      <div data-testid="state">
        {note ? `${note.x},${note.y},${note.width},${note.height}` : 'deleted'}
      </div>
      <div data-testid="count">{notes.length}</div>
      <div data-testid="preview">
        {interaction.preview
          ? `${interaction.preview.x},${interaction.preview.y},${interaction.preview.width},${interaction.preview.height},${interaction.preview.overTrash}`
          : 'none'}
      </div>
      <button type="button" onPointerDown={(event) => note && interaction.beginDrag(note, event)}>
        drag
      </button>
      <button type="button" onPointerDown={(event) => note && interaction.beginResize(note, event)}>
        resize
      </button>
      <button type="button" onClick={() => interaction.onBoardScroll()}>
        scroll
      </button>
    </div>
  );
}

async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

describe('useNoteInteraction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('commits a header drag without resizing', async () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 10, 20));
    fireEvent.pointerMove(window, pointerInit(1, 55, 40));
    await flushFrame();
    expect(screen.getByTestId('preview')).toHaveTextContent('245,170,200,160,false');
    fireEvent.pointerUp(window, pointerInit(1, 55, 40));
    expect(screen.getByTestId('state')).toHaveTextContent('245,170,200,160');
    expect(screen.getByTestId('preview')).toHaveTextContent('none');
  });

  it('resizes from the handle and keeps the note origin', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'resize' }), pointerInit(1, 0, 0));
    fireEvent.pointerUp(window, pointerInit(1, 30, -60));
    expect(screen.getByTestId('state')).toHaveTextContent('200,150,230,100');
  });

  it('keeps a note that leaves the trash before release', async () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={trashAtStart} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 300, 230));
    fireEvent.pointerMove(window, pointerInit(1, 310, 240));
    await flushFrame();
    expect(screen.getByTestId('preview').textContent).toContain('true');
    fireEvent.pointerMove(window, pointerInit(1, 400, 230));
    await flushFrame();
    expect(screen.getByTestId('preview').textContent).toContain('false');
    fireEvent.pointerUp(window, pointerInit(1, 400, 230));
    expect(screen.getByTestId('state')).toHaveTextContent('300,150,200,160');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('deletes when the pointer is released on any edge of the trash', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={trashAtStart} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 10, 20));
    fireEvent.pointerUp(window, pointerInit(1, 290, 220));
    expect(screen.getByTestId('state')).toHaveTextContent('deleted');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('keeps a note when the pointer is released just outside the trash', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={trashAtStart} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 10, 20));
    fireEvent.pointerUp(window, pointerInit(1, 289, 220));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('cancels on Escape, pointercancel, and blur without committing', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    const view = render(<Harness scroll={scroll} trash={trashAtStart} />);
    const drag = screen.getByRole('button', { name: 'drag' });

    fireEvent.pointerDown(drag, pointerInit(1, 0, 0));
    fireEvent.pointerMove(window, pointerInit(1, 40, 25));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(window, pointerInit(1, 40, 25));
    expect(screen.getByTestId('state')).toHaveTextContent('200,150,200,160');

    fireEvent.pointerDown(drag, pointerInit(1, 0, 0));
    fireEvent.pointerMove(window, pointerInit(1, 40, 25));
    fireEvent.pointerCancel(window, pointerInit(1, 40, 25));
    fireEvent.pointerUp(window, pointerInit(1, 40, 25));
    expect(screen.getByTestId('state')).toHaveTextContent('200,150,200,160');

    fireEvent.pointerDown(drag, pointerInit(1, 0, 0));
    fireEvent.blur(window);
    fireEvent.pointerUp(window, pointerInit(1, 80, 80));
    expect(screen.getByTestId('state')).toHaveTextContent('200,150,200,160');
    view.unmount();
  });

  it('cancels when an element loses pointer capture without the event bubbling', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerMove(window, pointerInit(1, 40, 25));
    document.body.dispatchEvent(
      new PointerEvent('lostpointercapture', {
        pointerId: 1,
        clientX: 40,
        clientY: 25,
        bubbles: false,
        button: 0,
        isPrimary: true,
      }),
    );
    fireEvent.pointerUp(window, pointerInit(1, 40, 25));
    expect(screen.getByTestId('state')).toHaveTextContent('200,150,200,160');
  });

  it('ignores a different pointer id and still commits the original pointer', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerMove(window, pointerInit(2, 80, 80));
    fireEvent.pointerUp(window, pointerInit(2, 80, 80));
    expect(screen.getByTestId('state')).toHaveTextContent('200,150,200,160');
    fireEvent.pointerUp(window, pointerInit(1, 15, 10));
    expect(screen.getByTestId('state')).toHaveTextContent('215,160,200,160');
  });

  it('commits the pointerup sample when a queued frame is flushed late', () => {
    const stolen: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      stolen.push(callback);
      return stolen.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerMove(window, pointerInit(1, 30, 10));
    fireEvent.pointerUp(window, pointerInit(1, 50, 20));
    expect(screen.getByTestId('state')).toHaveTextContent('250,170,200,160');
    act(() => {
      stolen[0]?.(0);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('250,170,200,160');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('does not restore a deleted note from a queued frame', () => {
    const stolen: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      stolen.push(callback);
      return stolen.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={trashAtStart} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerMove(window, pointerInit(1, 300, 230));
    fireEvent.pointerUp(window, pointerInit(1, 300, 230));
    expect(screen.getByTestId('state')).toHaveTextContent('deleted');
    act(() => {
      stolen[0]?.(0);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('deleted');
  });

  it('includes the scroll delta in the committed position', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    scroll.scrollLeft = 80;
    fireEvent.click(screen.getByRole('button', { name: 'scroll' }));
    fireEvent.pointerUp(window, pointerInit(1, 10, 10));
    expect(screen.getByTestId('state')).toHaveTextContent('290,160,200,160');
  });

  it('does not let lostpointercapture after release undo the move', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerUp(window, pointerInit(1, 25, 15));
    fireEvent.lostPointerCapture(window, pointerInit(1, 25, 15));
    expect(screen.getByTestId('state')).toHaveTextContent('225,165,200,160');
  });

  it('deletes when the pointer is released over a trash past the board edge', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    const outsideTrash: AxisRect = { left: 1700, top: 400, right: 1800, bottom: 500 };
    render(<Harness scroll={scroll} trash={outsideTrash} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerUp(window, pointerInit(1, 1700, 400));
    expect(screen.getByTestId('state')).toHaveTextContent('deleted');
  });

  it('clamps a note released outside the board and outside the trash', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerUp(window, pointerInit(1, 5000, 5000));
    expect(screen.getByTestId('state')).toHaveTextContent(
      `${BOARD_WIDTH - 200},${BOARD_HEIGHT - 160},200,160`,
    );
  });

  it('ignores a second gesture while one is active', () => {
    const scroll = { scrollLeft: 0, scrollTop: 0 };
    render(<Harness scroll={scroll} trash={null} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), pointerInit(1, 0, 0));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'resize' }), pointerInit(3, 0, 0));
    fireEvent.pointerUp(window, pointerInit(3, 80, 80));
    expect(screen.getByTestId('state')).toHaveTextContent('200,150,200,160');
    fireEvent.pointerUp(window, pointerInit(1, 12, 8));
    expect(screen.getByTestId('state')).toHaveTextContent('212,158,200,160');
  });
});
