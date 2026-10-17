import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH, MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH } from '../domain/constants';
import { createFixtureNotes, readFixtureCount } from './fixtureNotes';

describe('fixture notes', () => {
  it('accepts only the development counts', () => {
    expect(readFixtureCount('?fixture=20')).toBe(20);
    expect(readFixtureCount('?fixture=100')).toBe(100);
    expect(readFixtureCount('?fixture=300')).toBe(300);
    expect(readFixtureCount('?fixture=50')).toBeNull();
  });

  it('builds in-board notes for a 300-note pass', () => {
    const notes = createFixtureNotes(300);
    expect(notes).toHaveLength(300);
    for (const note of notes) {
      expect(note.width).toBeGreaterThanOrEqual(MIN_NOTE_WIDTH);
      expect(note.height).toBeGreaterThanOrEqual(MIN_NOTE_HEIGHT);
      expect(note.x + note.width).toBeLessThanOrEqual(BOARD_WIDTH);
      expect(note.y + note.height).toBeLessThanOrEqual(BOARD_HEIGHT);
    }
  });
});