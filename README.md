# Sticky Notes

A desktop single-page sticky-notes canvas. You can create a note at an exact board position and size, drag it, resize it from a corner handle, and delete it by releasing it over the trash zone.

## Features

- [x] Create at a specified position and size
- [x] Drag to move
- [x] Drag to resize
- [x] Drag over the trash zone and release to delete
- [x] Edit text, bring a note to the front, choose a color, and restore committed notes from local storage
- [ ] Not included: undo, keyboard nudging, and the optional REST API

## Run locally

```bash
npm ci
npm run dev
```

The dev server binds to `127.0.0.1` (port 5173 by default). On this Windows machine, Vite's default IPv6-only listen refused `http://127.0.0.1:5173`, so the config sets the host explicitly.

A development-only board is available at `http://127.0.0.1:5173/?fixture=20`, `?fixture=100`, or `?fixture=300`. Fixture mode does not read or write browser storage. It is omitted from the production build.

## Validation

Unit tests cover pure geometry, the reducer, and storage. Integration tests render the app and gesture hook in jsdom. End-to-end tests drive a real Chromium window for create, drag, resize, trash, Escape, and reload.

```bash
npm run test:unit          # Vitest, no browser
npm run test:integration   # Vitest + Testing Library
npx playwright install chromium
npm run test:e2e           # Playwright Chromium
npm test                   # unit and integration together
npm run test:all           # unit, integration, and e2e
```

On October 17, 2026, `npm run test:unit` passed 24 tests, `npm run test:integration` passed 20 tests, and `npm run test:e2e` passed 7 tests in Playwright Chromium. `npm run lint` and `npm run build` also passed.

## Architecture

Each note is plain data: an id, board-local x/y/width/height, text, one color from a fixed palette, and a dense z-index. A React reducer is the only owner of that committed list. The toolbar, scrollable canvas, note cards, and trash zone render the list and send commands back. Create, move, resize, delete, and trash hit testing are pure functions, so the geometry rules can be tested without a browser and without changing a note that the action does not touch.

Pointer interaction is one session at a time. Dragging starts on the note header and resizing starts on the corner handle. The session stores the note's starting rectangle and the pointer and scroll positions at pointer down. Every preview is that snapshot plus the current deltas, not a running total of rounded steps. Moves are drawn with a CSS transform, the drop shadow is removed during the gesture, and pointer moves are folded into a single animation frame. The pointer-up event commits the final rectangle. If the pointer lies inside the trash rectangle, the note is deleted; otherwise the move or resize is saved. Escape, window blur, pointer cancellation, and a lost capture before release discard the preview and leave the committed note as it was.

Text, color, and stacking sit on the same note records. localStorage keeps only committed notes in a versioned document and rejects unreadable or invalid data. Typing is saved after a short delay; creating, moving, resizing, recoloring, reordering, and deleting save immediately and are not written on each pointer move. Vitest covers the geometry, the reducer, storage failures, and gesture ordering, including a queued animation frame that must not restore a deleted note. Playwright repeats the create, drag, resize, trash, and reload flows in Chromium, because jsdom cannot prove pointer capture or layout. There is no server and no multi-tab merge: the last tab to write wins. A later REST adapter could replace the load and save functions, but it would need version checks so an older response cannot overwrite a newer edit.

## Assumptions and trade-offs

- Board bounds: the board is at least 1600 by 1000 and grows to the visible canvas, and to any note that extends past that canvas. A smaller window scrolls. A create request that does not fit is rejected and is not nudged into place. A drag follows the pointer past the board edge so the note can reach the trash; releasing anywhere else clamps it back inside. Resize stops at 120 by 96 and at the board edge.
- Trash hit test: the note is deleted only when the pointer is inside the trash zone's rectangle at pointer release. The whole zone counts, including its edges. Crossing the zone does not delete it. The zone stays fixed in the canvas viewport while the board scrolls.
- Gesture cancellation: Escape, blur, pointer cancel, and lost capture before release do not change committed geometry. Bringing a note to the front happens when it is selected, so that z-order change is kept if the drag is later cancelled.
- Browser coverage: interactive checks ran in Cursor's embedded Chromium on Windows (`Chrome/148.0.7778.280`), at 1024x768 and 1440x900. Google Chrome and Firefox are installed on this machine and were not driven. Microsoft Edge was not in the default install path. macOS was not available.
- Performance: in the development server, scripted drags of the top note on the 20, 100, and 300 note fixtures committed the pointer delta and recorded no long tasks during the event dispatch. Dispatch of pointer down, 30 moves, and pointer up took under 1 ms of JavaScript time. Waiting for animation frames on the 300 note board was about one second even while idle, with `document.visibilityState` still `visible`, so that delay is not reported as application frame time. The Chrome Performance panel and a production-build fixture were not measured. Preview updates still re-render the note list; that was left readable rather than memoized without a clean profile.
- Known limits: no undo, no keyboard move or resize, no REST API, and no conflict handling across browser tabs. Screen reader support is the labeled controls and text fields; moving and resizing are pointer actions.
