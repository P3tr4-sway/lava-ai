# Editor Cursor System Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Cursor interaction system for both StaffPreview (OSMD) and EditSurface (AlphaTab) views

---

## Summary

Replace the current default browser cursor and CSS-class-based selection highlights with a purpose-built cursor system. Four cursor modes — Select, Note Entry, Playback, and Hidden — provide clear visual feedback for each editor state. An SVG overlay renders the cursor line on top of both score views. Elastic snapping pulls the cursor toward beat 1 of each measure. During playback, the cursor turns gray and moves continuously driven by audio time.

---

## Cursor Modes

Four mutually exclusive modes, derived from toolbar + playback state:

| Mode | When Active | Appearance | Behavior |
|------|------------|------------|----------|
| **Select** | `activeToolGroup === 'selection'` and not playing | Thin vertical line, `var(--accent)` color, 80% opacity (100% when snapped) | Elastic snap to beat 1; single-click = select note, drag = range select bars |
| **Note Entry** | `activeToolGroup === 'note'` and not playing | CSS custom cursor: note icon SVG (~24x24), changes with selected duration | Click = insert note at hit-test position via existing caret + insertion flow |
| **Playback** | `playbackState === 'playing'` (any tool group) | Thin vertical line, `var(--text-muted)` (gray) | Smooth continuous movement via `requestAnimationFrame`; ignores mouse |
| **Hidden** | `activeToolGroup === 'notation'` or other non-cursor tools | Default browser cursor | No custom overlay |

### State transitions

- Press Play from any mode -> **Playback** (gray cursor takes over, 150ms fade from accent to gray)
- Press Stop -> return to previous mode (Select or Note Entry), cursor snaps to stop position, 150ms fade back to accent
- Press Pause -> gray cursor freezes in place, mouse regains normal pointer for click-to-select
- Switch toolbar tool group -> immediate cursor mode change (no transition animation)

### Deriving `cursorMode`

```
if playbackState === 'playing' -> 'playback'
else if activeToolGroup === 'note' -> 'noteEntry'
else if activeToolGroup === 'selection' -> 'select'
else -> 'hidden'
```

---

## SVG Overlay Architecture

### Component structure

```
<div className="relative" ref={containerRef}>   <- existing canvas wrapper
  <StaffPreview /> or <EditSurface />
  <CursorOverlay />                              <- new component
</div>
```

### CursorOverlay renders

- An `<svg>` matching the canvas dimensions, `position: absolute; inset: 0; pointer-events: none`
- **Select mode:** a `<line>` spanning the visible score height, x = `displayX` (snapped + lerped)
- **Playback mode:** same `<line>` but `stroke: var(--text-muted)`, x = `playbackX` (audio-driven)
- **Note Entry mode:** overlay is empty — cursor is a CSS `cursor: url(...)` on the canvas wrapper
- **Hidden mode:** overlay is empty

### Mouse event flow

- CursorOverlay has `pointer-events: none` — all clicks pass through to score beneath
- Mouse position captured via `onMouseMove` on the canvas wrapper `<div>`
- Wrapper dispatches position to the `useCursorEngine` hook

---

## Elastic Snapping (Select Mode Only)

### Snap targets

Beat 1 (barline) x-positions, gathered from:
- **StaffPreview:** `getMeasureBounds(barIndex)` from useScoreSync
- **EditSurface:** `boundsLookup` from AlphaTab API

A flat `snapPoints: number[]` array is cached and rebuilt on layout change (resize, re-render, scroll).

### Algorithm

```
snapRadius  = 30px   // magnetic zone around each barline
snapStrength = 0.6   // 0 = no pull, 1 = instant jump

on each mousemove:
  rawX = mouse x relative to canvas
  nearestSnap = closest snapX where |rawX - snapX| < snapRadius
  if nearestSnap exists:
    distance = |rawX - nearestSnap|
    pull = (1 - distance / snapRadius) * snapStrength
    targetX = rawX + (nearestSnap - rawX) * pull
  else:
    targetX = rawX

on each requestAnimationFrame:
  displayX = lerp(currentDisplayX, targetX, 0.3)
```

### Visual feedback

- Default: cursor line at 80% opacity of `var(--accent)`
- Snapped (within 5px of barline): cursor line at 100% opacity of `var(--accent)`

---

## Playback Cursor Animation

### Time-to-position mapping

On each `requestAnimationFrame` tick:

1. Read `currentTime` (seconds) from audioStore
2. Calculate fractional bar position: `barFloat = currentBar + (timeSinceBarStart / barDuration)`
3. Look up x-positions for current bar left edge and next bar left edge from measure bounds
4. Interpolate: `x = lerp(barLeftX, nextBarLeftX, fraction)`

### Scroll following

If the playback cursor moves past the visible viewport, the score container scrolls via `scrollTo({ left, behavior: 'smooth' })` to keep the cursor at ~30% from the left edge.

### Playback transitions

| Transition | Behavior |
|------------|----------|
| Play pressed | Cursor fades accent -> gray (150ms), detaches from mouse, starts animating |
| Stop pressed | Cursor snaps to stop position, fades gray -> accent (150ms), re-attaches to mouse |
| Pause pressed | Gray cursor freezes at current position; mouse resumes normal pointer for selection |
| Resume from pause | Gray cursor resumes from frozen position |

---

## Note Selection (Select Mode)

Replaces the old `selectionScope` split (note/bar/range) with a unified Select mode:

- **Single-click on note head** -> note highlights in `var(--accent)` (filled head + subtle drop-shadow), cursor line stops at note's x-position
- **Shift+click** -> adds to multi-selection
- **Click on empty space** -> deselect all
- **Click-drag across bars** -> range selection (bar-level)
- In StaffPreview: accent color applied to SVG note elements
- In EditSurface: tab number text gets accent color

---

## Note Entry (Note Tool Active)

- CSS `cursor: url(data:image/svg+xml,...)` with a note silhouette icon (~24x24px)
- Cursor icon changes based on selected duration:
  - Whole note, half note, quarter note, eighth note, sixteenth note — each a different SVG data URI
- Rest toggle: cursor switches to a rest symbol SVG
- Click on score -> inserts note at hit-test position via existing `setCaret()` + note insertion flow
- Switching to Select tool instantly swaps cursor (no animation)

---

## New Hook: `useCursorEngine(containerRef)`

A single hook that owns all cursor computation. No new Zustand store needed.

### Returned state

| Field | Type | Purpose |
|-------|------|---------|
| `cursorMode` | `'select' \| 'noteEntry' \| 'playback' \| 'hidden'` | Derived from toolbar + playback state |
| `displayX` | `number` | Current x after elastic snapping + lerp |
| `displayY` | `{ top: number; bottom: number }` | Vertical extent of the cursor line |
| `snapPoints` | `number[]` | Cached barline x-positions, rebuilt on layout change |
| `isSnapped` | `boolean` | Within 5px of a snap point (drives opacity) |
| `playbackX` | `number` | Audio-driven x during playback |

### Reads from existing stores

- `useEditorStore`: `activeToolGroup`, `selectedNoteIds`, `selectedBars`
- `useAudioStore`: `playbackState`, `currentBar`, `currentTime`, `bpm`

### Internal animation loop

A `requestAnimationFrame` loop inside the hook:
- In Select mode: lerps `displayX` toward `targetX` (snapped mouse position)
- In Playback mode: computes `playbackX` from audio time + measure bounds
- Stops looping when mode is Hidden or Note Entry

---

## Changes to Existing Code

### editorStore

- **Remove** `selectionScope` (`'note' | 'bar' | 'section' | 'range'`) — no longer needed
- **Simplify** `toolMode` — `'pointer'` and `'range'` merge into unified select behavior
- `selectBar()` and `selectNote()` remain but are triggered by click target, not mode
- **Migration for callers of `selectionScope`:** EditSurface's `handleMouseDown` currently branches on `selectionScope === 'note'` vs `'range'`/`'bar'`. Replace with click-target detection: if click hits a note element -> `selectNote()`, if click hits empty space and drag starts -> bar range select via `selectBar()`. The distinction is now "what did the user click" not "what mode are they in."

### EditorToolbar

- Selection tool button sets `activeToolGroup = 'selection'` (already does this)
- No separate "bar select" or "range select" sub-buttons needed

### StaffPreview & EditSurface

- Wrap in a container `<div>` with `<CursorOverlay />`
- Add `onMouseMove` on wrapper to feed mouse position to `useCursorEngine`
- Hide default cursor (`cursor: none`) when `cursorMode === 'select'` or `'playback'`
- Keep existing click handlers for note/bar selection and note insertion
- EditSurface: existing hit-test functions reused for note entry

### tokens.css

- `.vf-stavenote { cursor: pointer }` -> remove or make conditional (cursor is now managed by the overlay system)
- `.lava-note-selected` styling remains but accent color application may move to the overlay for consistency

### New files

- `client/src/hooks/useCursorEngine.ts` — the cursor engine hook
- `client/src/components/score/CursorOverlay.tsx` — SVG overlay component
- `client/src/lib/cursorIcons.ts` — SVG data URI generators for note/rest cursor icons
