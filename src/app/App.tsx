import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { NoteCanvas } from '../components/NoteCanvas';
import { StickyNote } from '../components/StickyNote';
import { Toolbar } from '../components/Toolbar';
import { TrashZone } from '../components/TrashZone';
import {
  boardSizeForViewport,
  MINIMUM_BOARD_SIZE,
  trashViewportOffset,
  validateCreateGeometry,
  type BoardSize,
} from '../domain/geometry';
import { createNoteId } from '../domain/ids';
import { nextZIndex, notesReducer } from '../domain/noteReducer';
import { NOTE_COLORS, type CreateGeometryInput } from '../domain/types';
import { createFixtureNotes, readFixtureCount } from '../dev/fixtureNotes';
import { useNoteInteraction } from '../hooks/useNoteInteraction';
import { getBrowserStorage, loadNotes } from '../persistence/noteStorage';
import { useNotePersistence } from '../persistence/useNotePersistence';
import { axisRectFromElement } from './rects';

type InitialBoard = {
  notes: ReturnType<typeof createFixtureNotes>;
  warning: string | null;
  persist: boolean;
};

function readInitialBoard(): InitialBoard {
  if (import.meta.env.DEV) {
    const count = readFixtureCount(window.location.search);
    if (count !== null) {
      return {
        notes: createFixtureNotes(count),
        warning: `Development fixture: ${count} notes. Browser storage is not used in this mode.`,
        persist: false,
      };
    }
  }

  const storage = getBrowserStorage();
  if (!storage) {
    return {
      notes: [],
      warning: 'Browser storage is unavailable. Notes will not be saved.',
      persist: false,
    };
  }

  const loaded = loadNotes(storage);
  if (loaded.status === 'ok') return { notes: loaded.notes, warning: null, persist: true };
  if (loaded.status === 'empty') return { notes: [], warning: null, persist: true };
  return { notes: [], warning: loaded.message, persist: true };
}

export function App() {
  const [initial] = useState(readInitialBoard);
  const [notes, dispatch] = useReducer(notesReducer, initial.notes);
  const [status, setStatus] = useState<string | null>(initial.warning);
  const [createError, setCreateError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<BoardSize>(MINIMUM_BOARD_SIZE);
  const [trashInset, setTrashInset] = useState({ right: 16, bottom: 16 });
  const placeTrashRef = useRef<() => void>(() => {});

  useNotePersistence(notes, initial.persist, setStatus);

  useLayoutEffect(() => {
    const measureBoard = () => {
      const viewport = scrollRef.current;
      if (!viewport) return;
      const next = boardSizeForViewport(
        { width: viewport.clientWidth, height: viewport.clientHeight },
        notes,
      );
      setBoardSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };
    measureBoard();
    const viewport = scrollRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measureBoard);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [notes]);

  useEffect(() => {
    const placeTrash = () => {
      const frame = frameRef.current;
      const board = boardRef.current;
      const frameRect = axisRectFromElement(frame);
      const boardRect = axisRectFromElement(board);
      if (!frameRect || !boardRect) return;
      const next = trashViewportOffset(frameRect, boardRect);
      setTrashInset((current) =>
        current.right === next.right && current.bottom === next.bottom ? current : next,
      );
    };
    placeTrashRef.current = placeTrash;
    placeTrash();
    const frame = frameRef.current;
    const board = boardRef.current;
    if (!frame || !board || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(placeTrash);
    observer.observe(frame);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const interaction = useNoteInteraction({
    dispatch,
    getScroll: () => ({
      scrollLeft: scrollRef.current?.scrollLeft ?? 0,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    }),
    hasBoard: () => boardRef.current !== null,
    getBoardSize: () => boardSize,
    getTrashRect: () => axisRectFromElement(trashRef.current),
  });

  const visibleNotes = useMemo(() => [...notes].sort((a, b) => a.zIndex - b.zIndex), [notes]);

  const createNote = (input: CreateGeometryInput): boolean => {
    const validation = validateCreateGeometry(input, boardSize);
    if (!validation.ok) {
      setCreateError(validation.message);
      return false;
    }
    setCreateError(null);
    dispatch({
      type: 'create',
      note: {
        id: createNoteId(),
        ...input,
        text: '',
        color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
        zIndex: nextZIndex(notes),
      },
    });
    return true;
  };

  return (
    <div className="flex h-screen flex-col bg-[#f4f1ea] text-stone-900">
      <Toolbar boardSize={boardSize} onCreate={createNote} error={createError} />
      {status ? (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          {status}
        </p>
      ) : null}
      <div ref={frameRef} className="relative min-h-0 flex-1">
        <NoteCanvas
          scrollRef={scrollRef}
          boardRef={boardRef}
          boardSize={boardSize}
          gesture={interaction.preview?.mode ?? 'idle'}
          onScroll={() => {
            interaction.onBoardScroll();
            placeTrashRef.current();
          }}
        >
          {notes.length === 0 ? (
            <p className="absolute left-6 top-6 max-w-md text-sm leading-6 text-stone-600">
              No notes yet. Enter a board position and size, then create a note. The board is{' '}
              {boardSize.width} by {boardSize.height}.
            </p>
          ) : null}
          {visibleNotes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              frame={interaction.preview?.noteId === note.id ? interaction.preview : note}
              active={interaction.preview?.noteId === note.id}
              onDragPointerDown={(event) => interaction.beginDrag(note, event)}
              onResizePointerDown={(event) => interaction.beginResize(note, event)}
              onChangeText={(text) => dispatch({ type: 'updateText', id: note.id, text })}
              onChangeColor={(color) => dispatch({ type: 'setColor', id: note.id, color })}
              onSelect={() => dispatch({ type: 'bringToFront', id: note.id })}
            />
          ))}
        </NoteCanvas>
        <TrashZone
          ref={trashRef}
          armed={interaction.preview?.overTrash === true}
          right={trashInset.right}
          bottom={trashInset.bottom}
        />
      </div>
    </div>
  );
}
