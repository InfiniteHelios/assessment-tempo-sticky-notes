/** Smallest logical board. A larger viewport or a note past this edge grows the board. */
export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 1000;

/** Reject stored coordinates past this edge so a corrupt file cannot create a huge board. */
export const MAX_STORED_BOARD_EDGE = 20000;

export const MIN_NOTE_WIDTH = 120;
export const MIN_NOTE_HEIGHT = 96;

export const DEFAULT_NOTE_X = 48;
export const DEFAULT_NOTE_Y = 48;
export const DEFAULT_NOTE_WIDTH = 220;
export const DEFAULT_NOTE_HEIGHT = 160;

export const TEXT_SAVE_DELAY_MS = 400;

/** Above every stored note z-index. The canvas stacking context keeps this under the trash. */
export const ACTIVE_NOTE_Z_INDEX = 1_000_000;
