import { useState, type FormEvent } from 'react';
import {
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_X,
  DEFAULT_NOTE_Y,
} from '../domain/constants';
import type { BoardSize } from '../domain/geometry';
import type { CreateGeometryInput } from '../domain/types';

const NUDGE_PX = 28;

type ToolbarProps = {
  boardSize: BoardSize;
  onCreate: (input: CreateGeometryInput) => boolean;
  error: string | null;
};

function parseField(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return Number.NaN;
  return Number(trimmed);
}

function nudge(current: string, size: number, limit: number): string {
  const value = Number(current);
  if (!Number.isFinite(value)) return current;
  const next = value + NUDGE_PX;
  if (next >= 0 && next + size <= limit) return String(next);
  return current;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `note-${label.toLowerCase()}`;
  return (
    <label htmlFor={id} className="flex flex-col text-xs font-medium text-stone-600">
      {label}
      <input
        id={id}
        value={value}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-20 rounded border border-stone-300 bg-white px-2 text-sm text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
      />
    </label>
  );
}

export function Toolbar({ boardSize, onCreate, error }: ToolbarProps) {
  const [x, setX] = useState(String(DEFAULT_NOTE_X));
  const [y, setY] = useState(String(DEFAULT_NOTE_Y));
  const [width, setWidth] = useState(String(DEFAULT_NOTE_WIDTH));
  const [height, setHeight] = useState(String(DEFAULT_NOTE_HEIGHT));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      x: parseField(x),
      y: parseField(y),
      width: parseField(width),
      height: parseField(height),
    };
    if (!onCreate(input)) return;
    setX((current) => nudge(current, input.width, boardSize.width));
    setY((current) => nudge(current, input.height, boardSize.height));
  };

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-300 bg-white px-4 py-2">
      <div className="mr-2">
        <h1 className="text-base font-semibold leading-5">Sticky Notes</h1>
        <p className="text-xs text-stone-500">
          Board {boardSize.width} by {boardSize.height}
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <NumberField label="X" value={x} onChange={setX} />
        <NumberField label="Y" value={y} onChange={setY} />
        <NumberField label="Width" value={width} onChange={setWidth} />
        <NumberField label="Height" value={height} onChange={setHeight} />
        <button
          type="submit"
          className="h-9 rounded bg-stone-900 px-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Create note
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </header>
  );
}
