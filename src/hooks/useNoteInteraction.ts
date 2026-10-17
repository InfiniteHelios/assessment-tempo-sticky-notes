import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clampNotePosition,
  isPointerOverTrash,
  resolveGestureGeometry,
  type AxisRect,
  type BoardSize,
  type GestureOrigin,
  type PointerSample,
} from '../domain/geometry';
import type { NoteAction } from '../domain/noteReducer';
import type { Note, NoteGeometry } from '../domain/types';

export type GesturePreview = NoteGeometry & {
  noteId: string;
  mode: 'dragging' | 'resizing';
  overTrash: boolean;
};

type ActiveGesture = {
  mode: 'dragging' | 'resizing';
  noteId: string;
  pointerId: number;
  origin: GestureOrigin;
  captureElement: HTMLElement;
};

type InteractionOptions = {
  dispatch: (action: NoteAction) => void;
  getScroll: () => { scrollLeft: number; scrollTop: number };
  hasBoard: () => boolean;
  getBoardSize: () => BoardSize;
  getTrashRect: () => AxisRect | null;
};

type InteractionApi = {
  beginDrag: (note: Note, event: ReactPointerEvent<HTMLElement>) => void;
  beginResize: (note: Note, event: ReactPointerEvent<HTMLElement>) => void;
  onBoardScroll: () => void;
};

function releasePointer(element: HTMLElement, pointerId: number) {
  try {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // The browser may already have released this pointer.
  }
}

const idleApi: InteractionApi = {
  beginDrag: () => {},
  beginResize: () => {},
  onBoardScroll: () => {},
};

export function useNoteInteraction(options: InteractionOptions) {
  const [preview, setPreview] = useState<GesturePreview | null>(null);
  const optionsRef = useRef(options);
  const apiRef = useRef<InteractionApi>(idleApi);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    let session: ActiveGesture | null = null;
    let pending: PointerSample | null = null;
    let lastSample: PointerSample | null = null;
    let rafId: number | null = null;

    const cancelScheduledFrame = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pending = null;
    };

    const pointerOverTrash = (mode: ActiveGesture['mode'], sample: PointerSample): boolean => {
      if (mode !== 'dragging') return false;
      const trashRect = optionsRef.current.getTrashRect();
      return (
        trashRect !== null &&
        isPointerOverTrash({ x: sample.clientX, y: sample.clientY }, trashRect)
      );
    };

    const buildPreview = (gesture: ActiveGesture, sample: PointerSample): GesturePreview => {
      const geometry = resolveGestureGeometry(
        gesture.mode,
        gesture.origin,
        sample,
        optionsRef.current.getBoardSize(),
      );
      return {
        noteId: gesture.noteId,
        mode: gesture.mode,
        ...geometry,
        overTrash: pointerOverTrash(gesture.mode, sample),
      };
    };

    const flush = () => {
      const gesture = session;
      const sample = pending;
      pending = null;
      if (!gesture || !sample) return;
      setPreview(buildPreview(gesture, sample));
    };

    const schedule = (sample: PointerSample) => {
      pending = sample;
      lastSample = sample;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        flush();
      });
    };

    const cancelGesture = () => {
      const gesture = session;
      session = null;
      cancelScheduledFrame();
      lastSample = null;
      if (gesture) releasePointer(gesture.captureElement, gesture.pointerId);
      setPreview(null);
    };

    const sampleFrom = (event: PointerEvent): PointerSample => {
      const scroll = optionsRef.current.getScroll();
      return {
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
      };
    };

    const begin = (mode: 'dragging' | 'resizing', note: Note, event: ReactPointerEvent<HTMLElement>) => {
      if (session) return;
      if (!event.isPrimary || event.button !== 0) return;
      if (!(event.currentTarget instanceof HTMLElement)) return;

      if (!optionsRef.current.hasBoard()) return;

      const scroll = optionsRef.current.getScroll();
      const origin: GestureOrigin = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: scroll.scrollLeft,
        startScrollTop: scroll.scrollTop,
        initial: {
          x: note.x,
          y: note.y,
          width: note.width,
          height: note.height,
        },
      };
      const sample: PointerSample = {
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
      };

      session = {
        mode,
        noteId: note.id,
        pointerId: event.pointerId,
        origin,
        captureElement: event.currentTarget,
      };
      lastSample = sample;

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is unavailable in some test environments; window listeners still track the pointer.
      }

      setPreview({
        noteId: note.id,
        mode,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        overTrash: pointerOverTrash(mode, sample),
      });
    };

    const onMove = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) return;
      schedule(sampleFrom(event));
    };

    const onUp = (event: PointerEvent) => {
      const gesture = session;
      if (!gesture || event.pointerId !== gesture.pointerId) return;

      // Clear the session before committing so a queued frame cannot overwrite or restore it.
      session = null;
      cancelScheduledFrame();
      lastSample = null;

      const sample = sampleFrom(event);
      const geometry = resolveGestureGeometry(
        gesture.mode,
        gesture.origin,
        sample,
        optionsRef.current.getBoardSize(),
      );
      const overTrash = pointerOverTrash(gesture.mode, sample);

      if (overTrash) {
        optionsRef.current.dispatch({ type: 'delete', id: gesture.noteId });
      } else if (gesture.mode === 'dragging') {
        const position = clampNotePosition(
          geometry.x,
          geometry.y,
          geometry.width,
          geometry.height,
          optionsRef.current.getBoardSize(),
        );
        optionsRef.current.dispatch({
          type: 'move',
          id: gesture.noteId,
          x: position.x,
          y: position.y,
        });
      } else {
        optionsRef.current.dispatch({
          type: 'resize',
          id: gesture.noteId,
          width: geometry.width,
          height: geometry.height,
        });
      }

      releasePointer(gesture.captureElement, gesture.pointerId);
      setPreview(null);
    };

    const onCancelPointer = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) return;
      cancelGesture();
    };

    const onLostCapture = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) return;
      // A lostpointercapture that follows pointerup sees an empty session and does not revert the commit.
      cancelGesture();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || session === null) return;
      event.preventDefault();
      cancelGesture();
    };

    const onBlur = () => {
      if (session === null) return;
      cancelGesture();
    };

    apiRef.current = {
      beginDrag: (note, event) => begin('dragging', note, event),
      beginResize: (note, event) => begin('resizing', note, event),
      onBoardScroll: () => {
        if (!session || !lastSample) return;
        const scroll = optionsRef.current.getScroll();
        schedule({
          ...lastSample,
          scrollLeft: scroll.scrollLeft,
          scrollTop: scroll.scrollTop,
        });
      },
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancelPointer);
    window.addEventListener('lostpointercapture', onLostCapture, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancelPointer);
      window.removeEventListener('lostpointercapture', onLostCapture, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      if (rafId !== null) cancelAnimationFrame(rafId);
      session = null;
      apiRef.current = idleApi;
    };
  }, []);

  const beginDrag = (note: Note, event: ReactPointerEvent<HTMLElement>) => {
    apiRef.current.beginDrag(note, event);
  };
  const beginResize = (note: Note, event: ReactPointerEvent<HTMLElement>) => {
    apiRef.current.beginResize(note, event);
  };
  const onBoardScroll = () => {
    apiRef.current.onBoardScroll();
  };

  return { preview, beginDrag, beginResize, onBoardScroll };
}
