import type { ReactNode, RefObject } from 'react';
import type { BoardSize } from '../domain/geometry';
import styles from './NoteCanvas.module.css';

type NoteCanvasProps = {
  scrollRef: RefObject<HTMLDivElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  boardSize: BoardSize;
  gesture: 'idle' | 'dragging' | 'resizing';
  onScroll: () => void;
  children: ReactNode;
};

export function NoteCanvas({
  scrollRef,
  boardRef,
  boardSize,
  gesture,
  onScroll,
  children,
}: NoteCanvasProps) {
  return (
    <div ref={scrollRef} className={styles.viewport} data-gesture={gesture} onScroll={onScroll}>
      <div
        ref={boardRef}
        role="region"
        aria-label="Note board"
        className={styles.board}
        style={{ width: boardSize.width, height: boardSize.height }}
      >
        {children}
      </div>
    </div>
  );
}
