# Score Editor — Guitar Pro Parity Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Guitar Lead Sheet editor with full Guitar Pro technique coverage, duration validation, and complete toolbar UI.

---

## 1. Goals

- Match Guitar Pro's editing capabilities for single-track guitar lead sheets
- Fix critical duration overflow bug (bars accept unlimited notes)
- Unify all editing paths through the ScoreCommand system (eliminate direct musicXmlEngine edits)
- Wire up all disconnected toolbar/keyboard events
- Provide complete UI panels for every technique with full parameterization

## 2. Non-Goals

- Multi-voice support (voice field exists but stays single-voice)
- Multi-track / orchestral scoring
- Piano grand staff
- Percussion notation
- Full dynamics beyond pp–ff (no ppp, fff, sfz)

---

## 3. Data Model Changes

### 3.1 Technique[] replaces TechniqueSet

Current `TechniqueSet` is boolean flags. Replace with a discriminated union array:

```ts
type Technique =
  | { type: 'bend'; style: 'full' | 'half' | 'pre-bend' | 'bend-release'; semitones: number }
  | { type: 'slide'; style: 'shift' | 'legato' | 'in-above' | 'in-below' | 'out-up' | 'out-down' }
  | { type: 'hammerOn' }
  | { type: 'pullOff' }
  | { type: 'tap' }
  | { type: 'tremoloPicking'; speed: 'eighth' | 'sixteenth' | 'thirtySecond' }
  | { type: 'tremoloBar'; semitones: number }
  | { type: 'letRing' }
  | { type: 'ghostNote' }
  | { type: 'deadNote' }
  | { type: 'palmMute' }
  | { type: 'harmonic'; style: 'natural' | 'pinch' | 'tap' | 'artificial' }
  | { type: 'vibrato'; style: 'normal' | 'wide' }
  | { type: 'pickStroke'; direction: 'up' | 'down' }
  | { type: 'arpeggio'; direction: 'up' | 'down' }
  | { type: 'accent'; style: 'normal' | 'heavy' }
  | { type: 'staccato' }
  | { type: 'tenuto' }
  | { type: 'fadeIn' }
```

### 3.2 ScoreNoteEvent additions

```ts
interface ScoreNoteEvent {
  // ... existing fields ...
  techniques: Technique[]                              // replaces TechniqueSet
  dots: number                                         // existing field, ensure command support
  tuplet?: { actual: number; normal: number }           // new: triplet = { actual: 3, normal: 2 }
}
```

### 3.3 Per-measure key/time signature

`ScoreMeasureMeta` already has optional `timeSignature?` and `keySignature?` fields. New commands will write to these (currently only global values are set).

---

## 4. Duration Validation + Auto-Truncation

### 4.1 Measure capacity

Determined by time signature:
- 4/4 → capacity = `4 * divisions`
- 3/4 → capacity = `3 * divisions`
- 6/8 → capacity = `3 * divisions` (in quarter-note units)

Per-measure time signature overrides the global value.

### 4.2 Effective duration calculation

```
effectiveDuration(note):
  base = noteTypeToDivisions(note.durationType)
  dotValue = base
  for i in 0..note.dots:
    dotValue /= 2
    base += dotValue
  if note.tuplet:
    base = base * note.tuplet.normal / note.tuplet.actual
  return base
```

### 4.3 validateAndTruncate

Triggered after: `insertNoteAtCaret`, `insertRestAtCaret`, `setDuration`, `splitNote`, `setMeasureTimeSignature`, `toggleDot`, `toggleTuplet`, `pasteSelection`.

Logic:
1. Compute capacity from measure's effective time signature
2. Sort notes by beat
3. For each note: if `beat * divisions + effectiveDuration > capacity`, truncate `durationDivisions` to remaining space, find closest valid `durationType`, clear dots
4. Remove notes whose beat start position is at or beyond capacity

### 4.4 UI feedback

No blocking dialogs. Truncated notes visually shorten on the score. Optionally include a warning string in `CommandResult.warnings[]` for toolbar display.

---

## 5. Command Modularization

### 5.1 New file structure

```
client/src/spaces/pack/editor-core/
  handlers/
    noteEntry.ts        — insertNoteAtCaret, insertRestAtCaret, insertNote, deleteNote
    noteProperties.ts   — setDuration, setPitch, setStringFret, toggleRest, setNoteDynamic
    techniques.ts       — addTechnique, removeTechnique (new Technique[] structure)
    noteMutation.ts     — splitNote, mergeWithNext, moveNoteToBeat, transposeSelection
    notation.ts         — toggleTie, toggleSlur, toggleDot (new), toggleTuplet (new)
    measures.ts         — addMeasureBefore, addMeasureAfter, deleteMeasureRange
    scoreMeta.ts        — setTempo, setKeySignature, setTimeSignature, setTrackClef, setCapo, setTuning/changeTuning
    measureMeta.ts      — setMeasureKeySignature (new), setMeasureTimeSignature (new), setBarlineType, setRepeat, setRepeatMarker, setChordSymbol, setAnnotation, setSectionLabel, setChordDiagramPlacement, reharmonizeSelection
    lyrics.ts           — setLyric (new)
    clipboard.ts        — copySelection (new), pasteSelection (new)
  validation.ts         — validateAndTruncate, computeEffectiveDuration, getMeasureCapacity
  commandRouter.ts      — switch dispatcher, delegates to handlers, runs validation post-command
  toolbarBridge.ts      — custom event → ScoreCommand mapping
  techniqueDefinitions.ts — data-driven technique definitions for toolbar generation
  commands.ts           — existing (durationToBeats, moveCaretByStep) — unchanged
  layout.ts             — existing — unchanged
```

### 5.2 commandRouter.ts

```ts
export function applyCommandToDocument(doc: ScoreDocument, cmd: ScoreCommand): CommandResult {
  const handler = HANDLER_MAP[cmd.type]
  if (!handler) return { document: doc, warnings: [`Unknown command: ${cmd.type}`] }

  const result = handler(doc, cmd)

  if (COMMANDS_NEEDING_VALIDATION.has(cmd.type)) {
    validateAndTruncate(result.document, cmd)
  }

  return result
}
```

### 5.3 scoreDocument.ts cleanup

`scoreDocument.ts` retains only:
- `createEmptyScoreDocument`, `cloneScoreDocument`, `buildScoreDigest`
- `parseMusicXmlToScoreDocument`, `exportScoreDocumentToMusicXml`
- Utility functions (pitch/fret resolution, etc.)

The `applyCommandToDocument` function in `scoreDocument.ts` is replaced by an import from `commandRouter.ts`.

### 5.4 musicXmlEngine.ts cleanup

Editing functions (`setNotePitch`, `setNoteDuration`, `toggleRest`, `toggleTie`, `setChord`, `setKeySig`, `setTimeSig`, `addBars`, `deleteBars`, `clearBars`, `transposeBars`) are deprecated and call sites migrated to `ScoreDocumentStore.applyCommand()`.

Retained: `parseXml`, `serializeXml`, `buildScoreSummary`, `buildNoteOnsetMap`, and other read-only utilities.

---

## 6. Toolbar Bridge — Event Wiring

### 6.1 toolbarBridge.ts

Centralized mapping from `window` custom events to `ScoreCommand` invocations:

| Event | Command |
|---|---|
| `lava-accidental` | `setPitch` (alter field) |
| `lava-dynamic` | `setNoteDynamic` |
| `lava-toggle-dot` | `toggleDot` (new) |
| `lava-toggle-triplet` | `toggleTuplet` (new) |
| `lava-transpose` | `transposeSelection` |
| `lava-copy` | `copySelection` (new) |
| `lava-paste` | `pasteSelection` (new) |
| `lava-open-fretboard` | Set `inspectorFocus` to `'fretboard'` |
| `lava-open-duration` | Set `inspectorFocus` to `'duration'` |

### 6.2 Registration

Single `useEffect` in `EditorPage.tsx`:

```ts
useEffect(() => {
  const cleanup = registerToolbarBridge(applyCommand, getEditorState)
  return cleanup
}, [])
```

### 6.3 New ScoreCommand types

Added to `score.ts`:
- `toggleDot` — cycle dots 0 → 1 → 2 → 0
- `toggleTuplet` — toggle triplet on/off on selected note
- `setLyric` — set lyric text on a note
- `pasteSelection` — deserialize from clipboard, insert at caret

Note: `copySelection` is NOT a ScoreCommand (no document mutation). It is a store action on `editorStore` that serializes selected notes/bars into `editorStore.clipboard`.
- `setMeasureTimeSignature` — set time signature on specific measure
- `setMeasureKeySignature` — set key signature on specific measure

---

## 7. Data-Driven Technique Toolbar

### 7.1 techniqueDefinitions.ts

Each technique defined as:

```ts
interface TechniqueDef {
  type: string                    // matches Technique.type
  label: string                   // display name
  icon: string                    // lucide-react icon name
  group: string                   // toolbar grouping key
  params: TechniqueParamDef[]     // parameter definitions
}

type TechniqueParamDef =
  | { key: string; kind: 'select'; options: string[]; default: string }
  | { key: string; kind: 'number'; min: number; max: number; step: number; default: number }
```

Full list of 19 technique definitions as enumerated in Section 3.1 (`Technique` union type) and Section 7.2 (group assignments).

### 7.2 Groups

| Group | Techniques |
|---|---|
| bend | bend |
| slide | slide |
| legato | hammerOn, pullOff, tap |
| mute | ghostNote, deadNote, palmMute |
| harmonic | harmonic |
| expression | vibrato |
| tremolo | tremoloPicking, tremoloBar |
| stroke | pickStroke, arpeggio |
| articulation | accent, staccato, tenuto, letRing, fadeIn |

### 7.3 TechniquePanel component

Generic component consuming `TechniqueDef`:
- No params → pure toggle button
- Select param → dropdown
- Number param → slider or number input
- Active techniques show active state + remove button

### 7.4 Toolbar integration

EditorToolbar renders technique groups from `TECHNIQUE_DEFS` using `groupBy(defs, 'group')`. Each group is a popover panel. Adding a new technique = adding one entry to `TECHNIQUE_DEFS`.

---

## 8. Toolbar Layout

### Row 1 — Note Input & Editing

| Slot | Tool | Description |
|---|---|---|
| 1 | Note Entry | Duration: whole, half, quarter, eighth, sixteenth |
| 2 | Rest | Insert rest (same duration) |
| 3 | Dot | Cycle 0→1→2→0 |
| 4 | Tuplet | Triplet toggle |
| 5 | Accidental | sharp / flat / natural |
| 6 | Tie / Slur | toggle tie, toggle slur |
| 7 | Dynamic | pp, p, mp, mf, f, ff |
| 8 | Lyric | Open inline lyric input |

### Row 2 — Techniques & Structure

| Slot | Tool | Description |
|---|---|---|
| 1 | Bend | bend, pre-bend, bend-release + semitone selector |
| 2 | Slide | 6 slide variants |
| 3 | Legato | hammer-on, pull-off, tap |
| 4 | Mute | ghost note, dead note, palm mute |
| 5 | Harmonic | natural, pinch, tap, artificial |
| 6 | Vibrato | normal, wide |
| 7 | Tremolo | tremolo picking + tremolo bar |
| 8 | Stroke | pick stroke, arpeggio |
| 9 | Articulation | accent, staccato, tenuto, let ring, fade in |
| 10 | Structure | key sig, time sig, tempo, barline, repeat, clef (existing panels) |

---

## 9. Keyboard Shortcuts

### New / Fixed

| Key | Action | Status |
|---|---|---|
| `.` | Toggle dot | Fix (wire handler) |
| `Shift+T` | Toggle triplet | Fix (wire handler) |
| `#` | Sharp | Fix (wire handler) |
| `B` | Flat | Fix (wire handler) |
| `N` | Natural | Fix (wire handler) |
| `Cmd+C` | Copy | Fix (implement handler) |
| `Cmd+V` | Paste | Fix (implement handler) |
| `Cmd+D` | Duplicate | Fix (implement handler) |
| `Cmd+Shift+Up` | Transpose up | Fix (wire handler) |
| `Cmd+Shift+Down` | Transpose down | Fix (wire handler) |
| `F` | Open fretboard inspector | Fix (wire handler) |
| `D` | Open duration inspector | Fix (wire handler) |
| `L` | Lyric input | Reassign (was toggle tie) |
| `Shift+L` | Toggle tie | New (replaces L) |

### Unchanged

Space, Cmd+Z, Cmd+Shift+Z, Escape, Delete, Backspace, arrows, Tab, Shift+Tab, 0-9, 1-5, Enter, V, C, T, K, R.

---

## 10. MusicXML Import/Export

### Export mapping (ScoreDocument → MusicXML)

| Data | MusicXML element |
|---|---|
| bend | `<technical><bend><bend-alter>N</bend-alter></bend>` |
| slide | `<technical><slide type="start"/>` |
| hammerOn | `<technical><hammer-on type="start">H</hammer-on>` |
| pullOff | `<technical><pull-off type="start">P</pull-off>` |
| tap | `<technical><tap/>` |
| harmonic (natural) | `<technical><harmonic><natural/></harmonic>` |
| harmonic (artificial) | `<technical><harmonic><artificial/></harmonic>` |
| tremoloPicking | `<ornaments><tremolo>N</tremolo></ornaments>` (3=32nd, 2=16th, 1=8th) |
| tremoloBar | `<technical><bend>` with negative bend-alter |
| letRing | `<technical><let-ring/>` |
| ghostNote | `<notehead parentheses="yes">normal</notehead>` |
| deadNote | `<notehead>x</notehead>` |
| palmMute | `<technical><palm-mute/>` |
| vibrato | `<ornaments><wavy-line type="start"/>` |
| pickStroke | `<direction-type><up-bow/>` or `<down-bow/>` |
| arpeggio | `<arpeggiate direction="up/down"/>` |
| fadeIn | `<wedge type="crescendo"/>` |
| dots | `<dot/>` (repeated for double dot) |
| tuplet | `<time-modification>` + `<tuplet type="start"/>` |
| lyric | `<lyric><syllabic>single</syllabic><text>...</text></lyric>` |
| per-measure timeSignature | `<attributes><time>` on that measure |
| per-measure keySignature | `<attributes><key>` on that measure |

### Import

Reverse parsing in `parseMusicXmlToScoreDocument`. Unknown elements are silently ignored (no crash). Guitar Pro MusicXML exports should import correctly.

### AlphaTab compatibility

AlphaTab natively renders most of these MusicXML elements. If a specific technique marker doesn't render visually, data integrity is preserved through MusicXML round-trip. Data correctness takes priority over visual rendering.

---

## 11. Copy/Paste

### Clipboard format

```ts
interface ScoreClipboard {
  notes: ScoreNoteEvent[]
  measures: ScoreMeasureMeta[]
  sourceMeasureCount: number
}
```

Stored in `editorStore.clipboard` (not system clipboard).

### Copy flow

1. Read `selectedBars` or `selectedNoteIds`
2. Bar selection → copy all notes + measure metadata, relativize beats (start from 0)
3. Note selection → copy only selected notes
4. Serialize to `editorStore.clipboard`

### Paste flow

1. Read from clipboard
2. Target = caret position (measureIndex + beat)
3. Insert notes one by one, each through `validateAndTruncate`
4. If paste range exceeds existing measures, auto-append measures via `addMeasureAfter`

---

## 12. Lyrics

### Command

```ts
{ type: 'setLyric', noteId: string, text: string }
```

### UI

Select a note → press `L` or click Lyric toolbar button → inline text input appears below the note. Tab advances to next note for continuous lyric entry. Enter/Escape exits lyric mode.

No separate lyrics panel needed.

---

## 13. Summary of New/Modified Files

| File | Change |
|---|---|
| `packages/shared/src/types/score.ts` | `Technique` union type, new command types, tuplet field |
| `client/src/lib/scoreDocument.ts` | Remove `applyCommandToDocument` (moved), keep import/export + utilities |
| `client/src/lib/musicXmlEngine.ts` | Deprecate editing functions, keep read-only utils |
| `client/src/spaces/pack/editor-core/commandRouter.ts` | New — central command dispatcher |
| `client/src/spaces/pack/editor-core/validation.ts` | New — duration validation + auto-truncation |
| `client/src/spaces/pack/editor-core/handlers/*.ts` | New — 10 handler modules |
| `client/src/spaces/pack/editor-core/toolbarBridge.ts` | New — event → command mapping |
| `client/src/spaces/pack/editor-core/techniqueDefinitions.ts` | New — data-driven technique registry |
| `client/src/spaces/pack/EditorToolbar.tsx` | Refactor — data-driven technique panels |
| `client/src/spaces/pack/EditorPage.tsx` | Register toolbar bridge |
| `client/src/spaces/pack/TabCanvas.tsx` | Update technique handling for Technique[] |
| `client/src/hooks/useEditorKeyboard.ts` | Fix broken shortcuts, add new ones |
| `client/src/stores/editorStore.ts` | Add clipboard field, lyric editing state |
| `client/src/stores/scoreDocumentStore.ts` | Point to commandRouter instead of inline switch |
