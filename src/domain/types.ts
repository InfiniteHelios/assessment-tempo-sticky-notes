export const NOTE_COLORS = ['yellow', 'mint', 'sky', 'pink'] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export type Note = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: NoteColor;
  zIndex: number;
};

export type NoteGeometry = Pick<Note, 'x' | 'y' | 'width' | 'height'>;

export type CreateGeometryInput = NoteGeometry;

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value);
}
