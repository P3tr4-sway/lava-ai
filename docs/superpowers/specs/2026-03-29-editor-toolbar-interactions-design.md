# Editor Toolbar & Score Interactions — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Target users:** Music lovers, guitar players with no professional training — keep everything simple and intuitive.

---

## Overview

Design the complete interaction model between the pack editor toolbar and the OSMD-rendered score. Every tool in the toolbar should produce visible, immediate feedback on the score. The system supports both bar-level and note-level selection, with context-aware floating toolbars, three pitch-input methods (drag, arrows, mini fretboard), and a MusicXML engine that makes all edits real.

### Technical Approach

**Hybrid HTML overlay + SVG class injection (Approach B+C):**

- **Highlights:** Inject CSS classes (`lava-bar-selected`, `lava-note-selected`, `lava-bar-playing`) directly into OSMD's SVG elements for pixel-perfect bar/note highlighting.
- **Interactive UI:** All interactive elements (selection rectangle, context pill, fretboard, duration palette, popovers, playback cursor) are React components rendered in an absolutely-positioned HTML overlay `<div>` on top of the OSMD container.
- **Coordination:** After every OSMD re-render, a `syncHighlights()` pass re-applies CSS classes, and overlay components reposition themselves based on OSMD bounding boxes.

---

## Section 1: Selection System & Visual Feedback

### Two selection granularities

**Bar-level selection** (pointer tool, range tool):
- Clicking a bar injects a CSS class (`lava-bar-selected`) onto the OSMD `vf-measure` SVG group → adds a semi-transparent accent rectangle behind the bar.
- Shift+click adds/removes bars from selection (additive toggle).
- `editorStore.selectedBars: number[]` remains the source of truth.
- After every OSMD re-render, a `syncHighlights()` function re-applies classes to selected bars.

**Note-level selection** (pointer tool when clicking directly on a note):
- Extends the existing `findClickedMeasure()` to a `findClickedElement(clientX, clientY)` that returns `{ type: 'bar' | 'note', barIndex, noteIndex? }`.
- Note detection: walk OSMD's SVG `vf-stavenote` elements, check bounding box hit.
- Selected note gets a `lava-note-selected` class → accent-colored ring/glow around the note head.
- New store field: `selectedNotes: { barIndex: number; noteIndex: number }[]`.
- Bar selection and note selection are mutually exclusive — selecting a note clears bar selection, and vice versa.

**Range drag selection** (range tool):
- Mouse down on score → record start point.
- Mouse move → render a semi-transparent selection rectangle as an absolutely-positioned HTML `<div>` over the score.
- Mouse up → find all bars whose bounding boxes intersect the rectangle → set `selectedBars`.
- Visual: the rectangle uses `bg-accent/15 border border-accent/40 rounded-lg` styling.
- After release, the rectangle disappears and the intersected bars show individual highlights.

### Playback cursor

- A thin vertical `<div>` (`w-0.5 bg-accent`) absolutely positioned over the score.
- Animates smoothly via `requestAnimationFrame`, interpolating position between bar boundaries based on `audioStore.currentTime`.
- Current bar also gets a subtle tint (`lava-bar-playing` class → `bg-accent/5`).
- Auto-scroll: when the cursor exits the visible viewport, the score container scrolls smoothly to keep 1 bar of leading space.
- Click-to-reposition: clicking any bar while stopped sets `audioStore.currentBar` and moves the cursor there.

---

## Section 2: Smart Context Pill

### Behavior

- Appears when 1+ bars or 1+ notes are selected.
- Floats above the selection (centered horizontally, offset ~8px above the topmost selected element).
- Repositions on scroll/zoom.
- Dismisses when selection is cleared (Escape, click empty area).

### Context-aware actions (shows 2-3 most relevant + "..." overflow)

**When empty bars are selected** (a bar is "empty" if it contains only rests and no chord symbols, lyrics, or annotations):
- "Set Chord" (primary) — opens chord popover
- "Set Key" — opens key/time sig popover
- "..." → Delete Bars, Copy, Duplicate, Add Text

**When bars with content are selected** (any bar has notes, chords, lyrics, or annotations):
- "Edit Chord" (primary)
- "Copy"
- "..." → Delete, Duplicate, Transpose, Clear Contents, Change Time Sig, Add Text

**When a single note is selected:**
- "Pitch" (primary) — opens fretboard/pitch editor
- "Duration" — opens duration palette
- "..." → Delete Note, Add Accidental, Tie/Slur, Toggle Rest, Add Lyric

**When multiple notes are selected:**
- "Transpose"
- "Duration"
- "..." → Delete, Copy, Add Accidental, Toggle Rest

### Styling

- `bg-surface-2 border border-border rounded-full px-2 py-1 shadow-lg`
- Buttons are small icon + label pairs (`text-xs text-text-secondary`)
- Primary action uses `text-text-primary font-medium`
- "..." overflow opens a dropdown menu below the pill
- `animate-fade-in` on appear

### Keyboard shortcuts

All actions also work via keyboard when something is selected:
- `Delete/Backspace` → Delete
- `Cmd+C / Cmd+V / Cmd+D` → Copy / Paste / Duplicate (paste inserts after the last selected bar; if nothing is selected, appends to end of score)
- `Cmd+Shift+Up/Down` → Transpose
- `1-5` → Duration (when a note is selected)
- `Escape` → Clear selection

---

## Section 3: Note Editing — Pitch, Duration, Fretboard

### Pitch editing (3 input methods)

**A) Drag up/down:**
- Click and hold a selected note → enters drag mode.
- As the mouse moves vertically, the note head visually follows, snapping to the nearest staff line/space.
- A small tooltip appears next to the cursor showing the note name (e.g., "A4", "F#3").
- Release to commit the new pitch.
- Visual: note head gets `opacity-60` during drag, a ghost note shows the target position at full opacity.

**B) Arrow keys:**
- With a note selected, Up/Down arrow moves pitch by one diatonic step.
- Shift+Up/Down moves by an octave.
- Each press immediately updates the note on the score with a quick `animate-fade-in` flash.
- The note name tooltip briefly appears ("C4 → D4").

**C) Mini fretboard:**
- Triggered from the context pill "Pitch" button, or by pressing `F` with a note selected.
- An HTML popover positioned below the selected note.
- Shows a simplified 6-string × 12-fret grid (the first 12 frets, enough for most playing).
- Current pitch is highlighted on the fretboard (the equivalent fret position).
- Tap any fret position → updates the note pitch immediately.
- String names labeled on the left (E A D G B E), fret numbers along the top.
- Styling: `bg-surface-1 border border-border rounded-lg shadow-xl p-3` with fret lines as `border-border` and dot inlays at standard positions (3, 5, 7, 9, 12).
- Dismisses on Escape, click outside, or selecting a different note (which repositions it).

### Duration editing (3 input methods)

**A) Duration palette:**
- Row of 5 buttons in a small popover: whole, half, quarter, eighth, sixteenth.
- Each is a simple note icon with label underneath ("1", "½", "¼", "⅛", "1/16").
- Current duration highlighted with `bg-surface-3`.
- Dot and triplet toggles as secondary row below.
- Triggered from context pill "Duration" or pressing `D` with note selected.

**B) Drag to resize:**
- With a note selected, drag its right edge horizontally.
- Visual: a thin handle appears on the right side of the note on hover.
- Dragging right = longer duration, left = shorter, snapping to valid values.
- Ghost preview shows the resulting duration before release.

**C) Number keys:**
- `1` = whole, `2` = half, `3` = quarter, `4` = eighth, `5` = sixteenth.
- `.` toggles dotted note, `Shift+T` toggles triplet (plain `T` is reserved for the Text tool).
- Instant application, no popover needed.

### Accidentals, ties, rests

From the "..." overflow menu or keyboard:
- `#` → sharp, `B` → flat, `N` → natural
- `L` → tie/slur to next note
- `R` → toggle rest (replaces note with rest of same duration)

---

## Section 4: Tool Modes — Complete Behavior Map

### Pointer Tool (`V`)
- **Default tool** — active on editor load.
- **Click bar:** selects bar (clears previous), shows bar-level context pill.
- **Click note:** selects note (clears previous), shows note-level context pill.
- **Shift+click:** additive toggle (add/remove from selection).
- **Click empty area:** clears all selection, dismisses context pill.
- **Drag on note:** enters pitch drag mode (see Section 3).
- **Drag on note right edge:** enters duration resize mode (see Section 3).
- **Cursor:** default arrow, changes to grab hand when hovering a note, horizontal resize when hovering note edge.

### Range Tool (`R`)
- **Click+drag on score:** draws selection rectangle, selects all intersected bars on release.
- **Shift+drag:** extends existing selection with new rectangle.
- **Click without drag:** selects single bar (falls back to pointer behavior).
- **Cursor:** crosshair.

### Chord Tool (`C`)
- **Click bar:** selects bar + immediately opens chord popover at that bar.
- **Click note/beat position:** opens chord popover anchored to that beat (for beat-level chord assignment).
- **Chord popover contents:** text input with autocomplete for common chords (Am, G, Cmaj7, etc.), organized by category (major, minor, 7th, etc.) — guitar-friendly naming, no Roman numerals.
- **Applying:** chord symbol appears above the staff at the selected position.
- **Cursor:** crosshair with `♯` badge.

### Key/Time Signature Tool (`K`)
- **Click bar:** selects bar + opens key/time sig popover.
- **Key picker:** circle-of-fifths visual or simple dropdown with major/minor toggle.
- **Time sig picker:** common options as buttons (4/4, 3/4, 6/8, 2/4) + custom input.
- **Applying:** changes key/time sig from that bar onward (inserts a key/time change in MusicXML).
- **Cursor:** crosshair with `♭` badge.

### Text Tool (`T`)
- **Click below staff:** opens lyric input — types lyrics that attach to notes (syllable-per-note, space/hyphen to advance).
- **Click above staff:** opens free annotation input — types text that floats above the bar as a rehearsal/performance note.
- **Tab:** advances to next note/bar position.
- **Styling:** lyrics in `text-xs text-text-secondary italic`, annotations in `text-xs text-text-primary font-medium`.
- **Cursor:** text I-beam.

### Tool switching
- Pressing a tool's shortcut key while using it returns to Pointer (toggle behavior).
- All tool shortcuts work regardless of focus (unless typing in an input).
- Active tool is highlighted in the toolbar with `bg-surface-3 text-text-primary`.

---

## Section 5: Undo/Redo & State Management

### Snapshot strategy
- Every mutation that changes the score creates an undo snapshot **before** applying the change.
- Snapshot = serialized copy of: `musicXml`, `sections`, `selectedBars`, `selectedNotes`.
- Max 50 undo entries (existing limit), FIFO eviction.
- Any new mutation after an undo clears the redo stack (standard behavior).

### What creates undo entries
- Adding/deleting bars
- Changing chord symbols
- Changing key or time signature
- Note pitch changes (committed on mouse-up for drag, per-step for arrows)
- Note duration changes
- Adding/removing accidentals, ties, rests
- Adding/editing/deleting lyrics or annotations
- Paste, duplicate, transpose operations
- Clear contents

### What does NOT create undo entries
- Selection changes (bar/note highlight)
- Zoom, scroll, view mode
- Playback state (play/pause/scrub)
- Tool mode switching
- Panel collapse/resize

### Coalescing
- Rapid arrow key presses for pitch (e.g., pressing Up 5 times quickly) coalesce into a single undo entry — debounced at 500ms of inactivity before committing a new snapshot.
- Drag operations commit one snapshot on mouse-up (not per-pixel).

### Redo
- `Cmd+Shift+Z` — pops from redo stack, pushes current state to undo stack.
- Toolbar redo button mirrors the shortcut.

### Auto-save integration
- Existing 2-second debounced auto-save continues to work.
- Undo/redo mutations mark the store as `unsaved`, triggering the auto-save cycle.
- `saveStatus` indicator in toolbar reflects current state.

---

## Section 6: MusicXML Round-Trip — Making Edits Real

### Architecture
- New module: `musicXmlEngine.ts` — a pure-function library that reads and writes MusicXML.
- Uses DOMParser/XMLSerializer (browser-native) to parse and manipulate the XML tree.
- OSMD remains read-only renderer — it never mutates, only receives updated XML strings.

### Operation flow
```
User action → editorStore mutation → musicXmlEngine transforms XML
  → leadSheetStore.setMusicXml(newXml) → OSMD re-renders → syncHighlights()
```

### Engine functions

| Function | Input | Output |
|---|---|---|
| `addBars(xml, afterIndex, count)` | MusicXML string, position, how many | Updated XML |
| `deleteBars(xml, barIndices)` | XML, array of indices | Updated XML |
| `setChord(xml, barIndex, beatIndex, chordSymbol)` | XML, position, chord string | Updated XML with `<harmony>` element |
| `setKeySig(xml, fromBar, key)` | XML, bar index, key name | Updated XML with `<key>` change |
| `setTimeSig(xml, fromBar, beats, beatType)` | XML, bar index, numerator, denominator | Updated XML |
| `setNotePitch(xml, barIndex, noteIndex, pitch)` | XML, position, new pitch | Updated XML |
| `setNoteDuration(xml, barIndex, noteIndex, duration)` | XML, position, new duration type | Updated XML |
| `addAccidental(xml, barIndex, noteIndex, type)` | XML, position, sharp/flat/natural | Updated XML |
| `toggleTie(xml, barIndex, noteIndex)` | XML, position | Updated XML |
| `toggleRest(xml, barIndex, noteIndex)` | XML, position | Updated XML |
| `transposeBars(xml, barIndices, semitones)` | XML, selection, direction | Updated XML |
| `duplicateBars(xml, barIndices, insertAfter)` | XML, selection, position | Updated XML |
| `clearBars(xml, barIndices)` | XML, selection | Updated XML (bars kept, contents replaced with rests) |
| `setLyric(xml, barIndex, noteIndex, syllable)` | XML, position, text | Updated XML with `<lyric>` element |
| `setAnnotation(xml, barIndex, text)` | XML, position, text | Updated XML with `<direction>` element |
| `copyBars(xml, barIndices)` | XML, selection | Extracted XML fragment (for clipboard) |
| `pasteBars(xml, fragment, afterIndex)` | XML, clipboard, position | Updated XML |

### Sync after re-render

After every `setMusicXml()` call triggers OSMD re-render:
1. `syncHighlights()` — re-applies `lava-bar-selected`, `lava-note-selected`, `lava-bar-playing` classes.
2. `syncCursorPosition()` — repositions the playback cursor div.
3. `syncContextPill()` — repositions the floating toolbar if selection is still active.

### Sections ↔ MusicXML bidirectional sync
- `leadSheetStore.sections` (the chord grid data model) stays in sync with MusicXML `<harmony>` elements.
- Editing via the score updates both the XML and the sections array.
- Editing via a future chord grid view updates sections and regenerates XML.

---

## New Files & Store Changes Summary

### New files
| File | Purpose |
|---|---|
| `client/src/lib/musicXmlEngine.ts` | Pure-function MusicXML manipulation library |
| `client/src/components/score/ScoreOverlay.tsx` | HTML overlay container for all interactive elements |
| `client/src/components/score/SelectionRect.tsx` | Range drag selection rectangle |
| `client/src/components/score/PlaybackCursor.tsx` | Animated vertical playback line |
| `client/src/components/score/ContextPill.tsx` | Smart floating toolbar |
| `client/src/components/score/MiniFretboard.tsx` | 6×12 fretboard pitch input |
| `client/src/components/score/DurationPalette.tsx` | Duration picker popover |
| `client/src/components/score/LyricInput.tsx` | Inline lyric text input |
| `client/src/components/score/AnnotationInput.tsx` | Inline annotation text input |
| `client/src/hooks/useScoreSync.ts` | Post-render sync (highlights, cursor, pill positioning) |
| `client/src/hooks/useRangeSelect.ts` | Range tool drag logic |
| `client/src/hooks/useNoteDrag.ts` | Pitch drag + duration resize logic |
| `client/src/hooks/usePlaybackCursor.ts` | rAF-based cursor animation + auto-scroll + note-level highlight |
| `client/src/components/score/ChordDiagram.tsx` | SVG guitar chord box component |
| `client/src/components/score/ChordDiagramPopover.tsx` | Hover/tap popover wrapper for chord diagrams |

### Store changes

**editorStore — additions:**
- `selectedNotes: { barIndex: number; noteIndex: number }[]`
- `selectNote(barIndex, noteIndex, additive?: boolean)`
- `clearNoteSelection()`
- `clipboard: string | null` (MusicXML fragment for copy/paste)
- `setClipboard(fragment)`
- `showChordDiagrams: boolean` (default `false`)
- `showBeatMarkers: boolean` (default `false`)
- `toggleChordDiagrams()`
- `toggleBeatMarkers()`

**editorStore — modifications:**
- `selectBar()` now also calls `clearNoteSelection()` (mutual exclusion)
- `selectNote()` now also calls `clearSelection()` on bars (mutual exclusion)
- `pushUndo()` now captures `{ musicXml, sections, selectedBars, selectedNotes }`

**leadSheetStore — additions:**
- None structurally — `setMusicXml()` already exists. Bidirectional sync logic lives in `musicXmlEngine.ts`.

**audioStore — no changes:**
- `currentBar`, `currentTime`, `setTransportState()` already exist and are sufficient for playback cursor.

---

## Section 7: Approachable Score Display — Training Wheels for Non-Pro Musicians

The target users are guitar lovers, not trained sight-readers. The score display must feel inviting rather than intimidating. Three helpers make notation approachable without dumbing it down.

### 7a: Guitar Chord Diagrams

**What:** Classic guitar chord box diagrams (4-fret grid showing finger dot positions, string names, open/muted string markers) displayed above chord symbols on the score.

**Interaction:**
- **Default (toggle off):** Hovering or tapping a chord name (e.g., "Am7") above the staff shows the chord diagram in a small popover.
- **Toggle on ("Show chord shapes" in toolbar):** Mini chord diagrams are always visible directly above each chord symbol, no interaction needed. Diagrams are rendered small (~40×48px) to avoid crowding the score.
- The toggle is a toolbar button (guitar icon) that persists across sessions (saved to project metadata).

**Chord diagram rendering:**
- Simple SVG component: 6 vertical string lines, 4 horizontal fret lines, filled circles for finger positions, "X" for muted strings, "O" for open strings.
- Common chord voicings built-in (standard open chords, bar chords). If a chord has no built-in voicing, show just the chord name without a diagram.
- Styling: `stroke-text-muted` for grid lines, `fill-text-primary` for finger dots, `text-[10px] text-text-secondary` for labels.

**New file:** `client/src/components/score/ChordDiagram.tsx`

### 7b: Beat Markers

**What:** Subtle visual grid lines between beats within each bar, so users can see the rhythmic structure without counting.

**Display:**
- Thin dashed vertical lines at each beat boundary within a bar (e.g., 4 lines in a 4/4 bar, 3 in a 3/4 bar).
- Styled as `stroke-border opacity-30 stroke-dasharray-2` — visible enough to guide the eye, subtle enough to not clutter.
- Beat 1 (downbeat) line is slightly more opaque (`opacity-50`) to anchor the bar.

**Implementation:**
- Injected into the OSMD SVG after render, positioned using OSMD's beat/tick position data.
- Toggled via a toolbar button ("Show beats") — off by default for clean look, on for learning mode.
- Persisted to project metadata like chord diagram toggle.

**New addition to:** `useScoreSync.ts` — `syncBeatMarkers()` function.

### 7c: Listening Highlight (Karaoke-Style Playback)

**What:** During playback, notes illuminate individually as they sound, creating a direct connection between what users hear and what they see on the score.

**Two-layer system (builds on Section 1 playback cursor):**
1. **Bar tint** (already designed): `lava-bar-playing` class gives the current bar a `bg-accent/5` background.
2. **Note glow:** The currently sounding note gets a `lava-note-playing` class → a warm glow/highlight on the note head that fades to the next note as playback advances.

**Animation:**
- As the playback cursor sweeps across a bar, each note in sequence gets the `lava-note-playing` class applied and the previous note's class removed.
- Timing is driven by `audioStore.currentTime` mapped against note onset times from the MusicXML (each `<note>` has a duration; cumulative durations give onset positions).
- The glow uses a CSS transition (`transition: opacity 100ms ease-out`) for smooth on/off rather than hard switching.

**Note onset mapping:**
- New utility: `buildNoteOnsetMap(xml: string): NoteOnset[]` in `musicXmlEngine.ts`
- Returns `{ barIndex, noteIndex, onsetTime (seconds), duration (seconds) }[]`
- Rebuilt whenever MusicXML changes. Cached in a ref.
- `usePlaybackCursor` hook consumes the onset map to drive note-level highlighting.

**Styling:**
```css
.lava-note-playing .vf-notehead path {
  fill: var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
  transition: fill 100ms ease-out, filter 100ms ease-out;
}
```

**Always-on during playback** — no toggle needed. When music plays, notes light up. This is the core "wow" moment that hooks casual users.

### Training wheels toolbar section

A small divider-separated group in the toolbar with two toggle buttons:
- **Guitar icon** — toggle chord diagrams always-visible (off by default)
- **Grid icon** — toggle beat markers (off by default)

Both show `bg-surface-3` when active. State saved to project metadata.

The listening highlight has no toggle — it's always active during playback.

### New files for Section 7
| File | Purpose |
|---|---|
| `client/src/components/score/ChordDiagram.tsx` | SVG guitar chord box component |
| `client/src/components/score/ChordDiagramPopover.tsx` | Hover/tap popover wrapper for chord diagrams |

### Store changes for Section 7
**editorStore — additions:**
- `showChordDiagrams: boolean` (default `false`)
- `showBeatMarkers: boolean` (default `false`)
- `toggleChordDiagrams()`
- `toggleBeatMarkers()`

### CSS additions (tokens.css)
```css
.lava-bar-selected > rect:first-child,
.lava-bar-selected > path:first-child { fill: var(--accent); opacity: 0.1; }

.lava-note-selected .vf-notehead path { stroke: var(--accent); stroke-width: 2; }

.lava-bar-playing > rect:first-child,
.lava-bar-playing > path:first-child { fill: var(--accent); opacity: 0.05; }

.lava-note-playing .vf-notehead path {
  fill: var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
  transition: fill 100ms ease-out, filter 100ms ease-out;
}

.lava-beat-marker { stroke: var(--border); opacity: 0.3; stroke-dasharray: 2; }
.lava-beat-marker-downbeat { opacity: 0.5; }
```
