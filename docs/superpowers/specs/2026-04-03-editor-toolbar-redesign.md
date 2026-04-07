# Editor Toolbar Redesign — Design Spec

**Date:** 2026-04-03  
**Branch:** codex/toolbar_new_ux  
**Scope:** Merge `ScoreSidebarToolbar` into `EditorToolbar`; redesign to two-row solid minimalist layout. Keyboard shortcuts deferred.

---

## Background

The editor currently has two separate toolbar components:

- `EditorToolbar.tsx` — bottom-centered floating toolbar (play/edit tools + mode switch)
- `ScoreSidebarToolbar.tsx` — left floating panel, 13 tools, fineEdit mode only

The left sidebar panel is being dissolved. All tools are merged into a redesigned bottom toolbar with two horizontal rows.

**Keyboard shortcuts (`1`-`0`) are not implemented in this iteration.** Number keys are fully reserved for fret entry and duration input. Badge numbers on buttons serve as visual affordance only — a placeholder for a future shortcut scheme to be designed separately.

---

## Tools

### Removed from sidebar
- `Keyboard` — removed
- `Layout` — removed

### Sidebar tools merged in (11 total)
Clefs, Key signatures, Time signatures, Tempo, Pitch, Accidentals, Dynamics, Articulations\*, Text, Repeats & jumps, Barlines

\* Sidebar `Articulations` (Accent/Staccato/Tenuto/Marcato) is merged into the existing `Ties, slurs & articulations` panel — no duplicate tool added.

### Existing bottom toolbar tools retained
Selection, Notes & rests, Ties/slurs/articulations, Chord diagrams, Zoom, Playback style

---

## Two-Row Layout (fineEdit mode)

```
┌─────────────────────────────────────────────────────┬──────────┐
│  ①Select  ②Notes  ③Acc  ④Ties  ⑤Dyn  ⑥Text          │          │
├─────────────────────────────────────────────────────┤  toggle  │
│  ⑦KeySig  ⑧TimeSig  ⑨Repeat  ⑩Barline  Clef  Tempo… │          │
└─────────────────────────────────────────────────────┴──────────┘
```

- **Row 1 (top)** — note/rhythm tools: Selection · Notes & rests · Accidentals · Ties/Slurs/Articulations · Dynamics · Text
- **Row 2 (bottom)** — structural/marking tools: Key signatures · Time signatures · Repeats & jumps · Barlines · Clefs · Tempo · Pitch · Chord diagrams · Zoom · Playback style
- **Mode toggle** — rightmost column, spans full height of both rows, `border-l border-border`

Number badges (①–⑩) are visual-only. They are not wired to keyboard events.

---

## Badge Design

- Position: bottom-right corner of each button
- Style: `text-[10px] text-text-muted`
- Shown on the first 10 tools (Row 1: 1–6, Row 2: 7–0)
- Hidden when the tool is active (active state uses green background — badge would clash)
- Tools without a badge number: Clefs, Tempo, Pitch, Chord diagrams, Zoom, Playback style

---

## Visual Style

- **Background:** `bg-surface-0` (solid, no transparency)
- **No `backdrop-blur`**, no frosted glass
- **Border:** `border border-border`, `rounded-[12px]`
- **Shadow:** `shadow-sm` or none
- **Row divider:** `border-t border-border` between row 1 and row 2
- **Toggle divider:** `border-l border-border`
- **Active tool:** `bg-[#8df790]` (existing green, unchanged)

---

## Chevron Panels

Tools with sub-options retain the existing hover/chevron expand mechanism. Panel floats above the toolbar, anchored to the triggering button. No behavior change.

Tools gaining chevron panels in this iteration:
- Accidentals (Sharp / Flat / Natural / Courtesy accidental)
- Dynamics (pp / p / mf / ff)
- Key signatures (C major / G major / D major / A minor)
- Time signatures (4/4 / 3/4 / 6/8 / 12/8)
- Repeats & jumps (Repeat start / Repeat end / D.C. al Fine / Segno)
- Barlines (Single / Double / Final / Dashed)
- Clefs (Treble / Bass / Alto / Tenor)
- Tempo (Largo / Andante / Moderato / Allegro)
- Pitch (Concert pitch / Octave up / Octave down / Chromatic)

---

## Transform Mode

In `transform` (playback) mode, both rows are hidden. Only existing playback tools are shown (Play/Pause · Playback style · Settings · Metronome) plus the mode toggle. Behavior unchanged.

---

## Files Affected

| File | Change |
|------|--------|
| `client/src/spaces/pack/EditorToolbar.tsx` | Major rewrite — two-row layout, 11 new tools, badge numbers |
| `client/src/spaces/pack/ScoreSidebarToolbar.tsx` | Delete |
| `client/src/spaces/pack/EditorCanvas.tsx` | Remove `ScoreSidebarToolbar` import and render call |
| `client/src/stores/editorStore.ts` | Verify `activeToolGroup` covers all new tool IDs |

`useEditorKeyboard.ts` — no changes in this iteration.
