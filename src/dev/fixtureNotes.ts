import { BOARD_HEIGHT, BOARD_WIDTH } from '../domain/constants';
import { NOTE_COLORS, type Note } from '../domain/types';

const ALLOWED_COUNTS = [20, 100, 300] as const;

export function readFixtureCount(search: string): number | null {
  const value = new URLSearchParams(search).get('fixture');
  const count = Number(value);
  return (ALLOWED_COUNTS as readonly number[]).includes(count) ? count : null;
}

/** Overlapping valid notes for a development performance pass. Not used in production UI. */
export function createFixtureNotes(count: number): Note[] {
  const notes: Note[] = [];
  const width = 150;
  const height = 110;

  for (let index = 0; index < count; index += 1) {
    const column = index % 20;
    const row = Math.floor(index / 20) % 12;
    const x = 16 + column * 70;
    const y = 16 + row * 70;
    if (x + width > BOARD_WIDTH || y + height > BOARD_HEIGHT) continue;
    notes.push({
      id: `fixture-${index + 1}`,
      x,
      y,
      width,
      height,
      text: `Fixture ${index + 1}`,
      color: NOTE_COLORS[index % NOTE_COLORS.length],
      zIndex: index + 1,
    });
  }

  return notes;
}
