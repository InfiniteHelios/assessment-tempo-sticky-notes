import type { PointerEvent } from 'react';
import { ACTIVE_NOTE_Z_INDEX } from '../domain/constants';
import { NOTE_COLORS, type Note, type NoteColor, type NoteGeometry } from '../domain/types';
import styles from './StickyNote.module.css';

type StickyNoteProps = {
  note: Note;
  frame: NoteGeometry;
  active: boolean;
  onDragPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onResizePointerDown: (event: PointerEvent<HTMLElement>) => void;
  onChangeText: (text: string) => void;
  onChangeColor: (color: NoteColor) => void;
  onSelect: () => void;
};

export function StickyNote({
  note,
  frame,
  active,
  onDragPointerDown,
  onResizePointerDown,
  onChangeText,
  onChangeColor,
  onSelect,
}: StickyNoteProps) {
  const dragLabel = note.text.trim()
    ? `Drag note: ${note.text.trim().slice(0, 40)}`
    : 'Drag note';

  return (
    <article
      className={styles.note}
      data-note-id={note.id}
      data-color={note.color}
      data-active={active ? 'true' : 'false'}
      data-x={frame.x}
      data-y={frame.y}
      data-width={frame.width}
      data-height={frame.height}
      data-z={note.zIndex}
      style={{
        width: frame.width,
        height: frame.height,
        transform: `translate(${frame.x}px, ${frame.y}px)`,
        zIndex: active ? ACTIVE_NOTE_Z_INDEX : note.zIndex,
      }}
    >
      <div
        className={styles.handle}
        role="button"
        tabIndex={0}
        aria-label={dragLabel}
        aria-grabbed={active}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
          onDragPointerDown(event);
        }}
      >
        <span>Note</span>
        <div className={styles.colors} role="group" aria-label="Note color">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={styles.swatch}
              data-color={color}
              aria-label={`${color} color`}
              aria-pressed={note.color === color}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                onSelect();
                onChangeColor(color);
              }}
            />
          ))}
        </div>
      </div>
      <textarea
        className={styles.text}
        value={note.text}
        aria-label="Note text"
        placeholder="Write a note"
        onChange={(event) => onChangeText(event.target.value)}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      />
      <div
        className={styles.resize}
        role="button"
        tabIndex={0}
        aria-label="Resize note"
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
          onResizePointerDown(event);
        }}
      />
    </article>
  );
}
