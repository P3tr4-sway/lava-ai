# Score Editor — Guitar Pro Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the score editor to match Guitar Pro's editing capabilities for single-track guitar lead sheets — full technique parameterization, duration validation with auto-truncation, modular command architecture, and complete toolbar UI.

**Architecture:** Split the monolithic `applyCommandToDocument` (1100+ lines in `scoreDocument.ts`) into modular command handlers under `editor-core/handlers/`. Introduce a central `commandRouter.ts` that dispatches commands and runs post-command validation. Replace boolean `TechniqueSet` with a discriminated union `Technique[]`. Wire all orphaned custom events through a `toolbarBridge.ts`. Build technique toolbar panels data-driven from a `techniqueDefinitions.ts` registry.

**Tech Stack:** TypeScript 5 (strict), React 18, Zustand, AlphaTab (rendering only), MusicXML, Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-score-editor-guitar-pro-parity.md`

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `client/src/spaces/pack/editor-core/handlers/noteEntry.ts` | insertNote, insertNoteAtCaret, insertRestAtCaret, deleteNote |
| `client/src/spaces/pack/editor-core/handlers/noteProperties.ts` | setDuration, setPitch, setStringFret, toggleRest, setNoteDynamic |
| `client/src/spaces/pack/editor-core/handlers/techniques.ts` | addTechnique, removeTechnique (new Technique[] API) |
| `client/src/spaces/pack/editor-core/handlers/noteMutation.ts` | splitNote, mergeWithNext, moveNoteToBeat, transposeSelection |
| `client/src/spaces/pack/editor-core/handlers/notation.ts` | toggleTie, toggleSlur, toggleDot, toggleTuplet |
| `client/src/spaces/pack/editor-core/handlers/measures.ts` | addMeasureBefore, addMeasureAfter, deleteMeasureRange |
| `client/src/spaces/pack/editor-core/handlers/scoreMeta.ts` | setTempo, setKeySignature, setTimeSignature, setTrackClef, setCapo, changeTuning |
| `client/src/spaces/pack/editor-core/handlers/measureMeta.ts` | setMeasureKeySignature, setMeasureTimeSignature, setBarlineType, setRepeat, setRepeatMarker, setChordSymbol, setAnnotation, setSectionLabel, setChordDiagramPlacement, reharmonizeSelection |
| `client/src/spaces/pack/editor-core/handlers/lyrics.ts` | setLyric |
| `client/src/spaces/pack/editor-core/handlers/clipboard.ts` | pasteSelection |
| `client/src/spaces/pack/editor-core/validation.ts` | validateAndTruncate, computeEffectiveDuration, getMeasureCapacity |
| `client/src/spaces/pack/editor-core/commandRouter.ts` | Central dispatcher: command → handler → validation |
| `client/src/spaces/pack/editor-core/toolbarBridge.ts` | Custom event → ScoreCommand mapping + registration |
| `client/src/spaces/pack/editor-core/techniqueDefinitions.ts` | Data-driven technique registry for toolbar generation |
| `client/src/components/ui/TechniquePanel.tsx` | Generic technique panel component |

### Modified files

| File | Change |
|---|---|
| `packages/shared/src/types/score.ts` | Replace TechniqueSet with Technique union; add new ScoreCommand variants; add tuplet to ScoreNoteEvent |
| `client/src/lib/scoreDocument.ts` | Remove applyCommandToDocument (moved); update parseMusicXmlToScoreDocument and exportScoreDocumentToMusicXml for new techniques/tuplet/dots/lyrics; extract shared helpers |
| `client/src/stores/scoreDocumentStore.ts` | Import applyCommandToDocument from commandRouter instead of scoreDocument |
| `client/src/stores/editorStore.ts` | Change clipboard type to ScoreClipboard; add lyricEditingNoteId state |
| `client/src/spaces/pack/EditorToolbar.tsx` | Refactor technique panels to data-driven; add Row 1/Row 2 layout per spec |
| `client/src/spaces/pack/EditorPage.tsx` | Register toolbarBridge |
| `client/src/spaces/pack/TabCanvas.tsx` | Update technique rendering for Technique[] |
| `client/src/hooks/useEditorKeyboard.ts` | Fix broken shortcuts; reassign L→lyric, Shift+L→tie |
| `client/src/lib/musicXmlEngine.ts` | Remove editing functions, keep read-only utils |

### Test files

| File | Tests for |
|---|---|
| `client/src/spaces/pack/editor-core/validation.test.ts` | Duration validation + truncation |
| `client/src/spaces/pack/editor-core/commandRouter.test.ts` | Command routing + post-validation |
| `client/src/spaces/pack/editor-core/handlers/noteEntry.test.ts` | Note insertion + deletion |
| `client/src/spaces/pack/editor-core/handlers/techniques.test.ts` | Technique add/remove with params |
| `client/src/spaces/pack/editor-core/handlers/notation.test.ts` | toggleDot, toggleTuplet |
| `client/src/spaces/pack/editor-core/handlers/clipboard.test.ts` | pasteSelection |
| `client/src/spaces/pack/editor-core/handlers/measureMeta.test.ts` | Per-measure key/time sig |

---

## Task 1: Shared Types — Technique Union + New Commands

**Files:**
- Modify: `packages/shared/src/types/score.ts`

This is the foundation — every subsequent task depends on these types.

- [ ] **Step 1: Replace TechniqueSet with Technique discriminated union**

In `packages/shared/src/types/score.ts`, replace the `TechniqueSet` interface (lines 67-78) with:

```ts
// --- Technique discriminated union (replaces TechniqueSet) ---

export type Technique =
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

/** @deprecated Use Technique[] instead */
export interface TechniqueSet {
  bend?: boolean
  slide?: boolean
  hammerOn?: boolean
  pullOff?: boolean
  palmMute?: boolean
  harmonic?: boolean
  vibrato?: boolean
  accent?: boolean
  staccato?: boolean
  tenuto?: boolean
}
```

Keep the old `TechniqueSet` interface with `@deprecated` tag temporarily for compilation. It will be removed after all consumers are migrated.

- [ ] **Step 2: Update ScoreNoteEvent to use Technique[]**

In `ScoreNoteEvent` (lines 92-114), change:
```ts
// Before:
techniques: TechniqueSet

// After:
techniques: Technique[]
tuplet?: { actual: number; normal: number }
```

- [ ] **Step 3: Add new ScoreCommand variants**

In the `ScoreCommand` union (lines 173-212), add these new variants:

```ts
  | { type: 'toggleDot'; noteId: string }
  | { type: 'toggleTuplet'; noteId: string; actual: number; normal: number }
  | { type: 'setLyric'; noteId: string; text: string }
  | { type: 'pasteSelection'; targetTrackId: string; targetMeasureIndex: number; targetBeat: number; clipboard: ScoreClipboard }
  | { type: 'setMeasureTimeSignature'; measureIndex: number; timeSignature: TimeSignature }
  | { type: 'setMeasureKeySignature'; measureIndex: number; keySignature: KeySignature }
```

Also add the `ScoreClipboard` interface near the top of the file:

```ts
export interface ScoreClipboard {
  notes: ScoreNoteEvent[]
  measures: ScoreMeasureMeta[]
  sourceMeasureCount: number
}
```

- [ ] **Step 4: Update addTechnique / removeTechnique command signatures**

Change the existing `addTechnique` and `removeTechnique` command variants to work with the new `Technique` type:

```ts
// Before:
| { type: 'addTechnique'; noteId: string; technique: keyof TechniqueSet }
| { type: 'removeTechnique'; noteId: string; technique: keyof TechniqueSet }

// After:
| { type: 'addTechnique'; noteId: string; technique: Technique }
| { type: 'removeTechnique'; noteId: string; techniqueType: Technique['type'] }
```

- [ ] **Step 5: Run typecheck to see all breakages**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`

Expected: Multiple type errors in files that reference `TechniqueSet` or the old `addTechnique`/`removeTechnique` signatures. Catalog every error — these will be fixed in subsequent tasks.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/score.ts
git commit -m "feat(types): replace TechniqueSet with Technique union, add new command variants"
```

---

## Task 2: Shared Helpers — Extract from scoreDocument.ts

**Files:**
- Create: `client/src/spaces/pack/editor-core/helpers.ts`
- Modify: `client/src/lib/scoreDocument.ts`

Extract utility functions that command handlers will share (pitch/fret resolution, note type conversions, ID generation) so handlers don't depend on `scoreDocument.ts`.

- [ ] **Step 1: Create helpers.ts with extracted functions**

Create `client/src/spaces/pack/editor-core/helpers.ts`. Copy these functions from `scoreDocument.ts`:

```ts
import type {
  GuitarPlacement,
  KeySignature,
  NoteValue,
  ScoreDocument,
  ScoreMeasureMeta,
  ScoreNoteEvent,
  ScorePitch,
  ScoreTrack,
  Technique,
  TimeSignature,
} from '@lava/shared'
import { fretToMidi, midiToFret, midiToPitch, pitchToMidi } from '@/lib/pitchUtils'

// --- ID generation ---
let idCounter = 0
export function createId(): string {
  return `${Date.now().toString(36)}-${(idCounter++).toString(36)}`
}

// --- Duration conversions ---
const NOTE_TYPE_TO_DIVISOR: Record<NoteValue, number> = {
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
  sixteenth: 16,
}

export function noteTypeToDivisions(type: NoteValue, divisions: number): number {
  return Math.round((divisions * 4) / NOTE_TYPE_TO_DIVISOR[type])
}

export function divisionsToNoteType(dur: number, divisions: number): NoteValue {
  const ratio = dur / divisions
  if (ratio >= 4) return 'whole'
  if (ratio >= 2) return 'half'
  if (ratio >= 1) return 'quarter'
  if (ratio >= 0.5) return 'eighth'
  return 'sixteenth'
}

// --- Pitch / fret resolution ---
export function choosePlacement(
  pitch: ScorePitch,
  tuning: number[],
  capo: number,
): GuitarPlacement | null {
  const midi = pitchToMidi(pitch)
  const result = midiToFret(midi, tuning, capo)
  return result
    ? { string: result.string, fret: result.fret, confidence: 'exact' as const }
    : null
}

export function resolvePitchFromPlacement(
  placement: GuitarPlacement,
  tuning: number[],
  capo: number,
): ScorePitch {
  const midi = fretToMidi(placement.string, placement.fret, tuning, capo)
  return midiToPitch(midi)
}

// --- Measure helpers ---
export function getEffectiveTimeSignature(
  doc: ScoreDocument,
  measureIndex: number,
): TimeSignature {
  // Walk backwards from measureIndex to find the most recent per-measure time sig
  for (let i = measureIndex; i >= 0; i--) {
    const meta = doc.measures[i]
    if (meta?.timeSignature) return meta.timeSignature
  }
  return doc.meter
}

export function getEffectiveKeySignature(
  doc: ScoreDocument,
  measureIndex: number,
): KeySignature {
  for (let i = measureIndex; i >= 0; i--) {
    const meta = doc.measures[i]
    if (meta?.keySignature) return meta.keySignature
  }
  return doc.keySignature
}

// --- Note helpers ---
export function cloneNote(note: ScoreNoteEvent): ScoreNoteEvent {
  return {
    ...note,
    techniques: note.techniques.map((t) => ({ ...t })),
    pitch: note.pitch ? { ...note.pitch } : null,
    placement: note.placement ? { ...note.placement } : null,
    displayHints: note.displayHints ? { ...note.displayHints } : undefined,
  }
}

export function updateTrackNotes(
  track: ScoreTrack,
  updater: (notes: ScoreNoteEvent[]) => ScoreNoteEvent[],
): ScoreTrack {
  return { ...track, notes: updater([...track.notes]) }
}

// --- Measure metadata ---
export function createMeasureMeta(index: number): ScoreMeasureMeta {
  return {
    id: createId(),
    index,
    harmony: [],
    annotations: [],
  }
}
```

- [ ] **Step 2: Update scoreDocument.ts to import from helpers.ts**

In `scoreDocument.ts`, replace the internal implementations of `createId`, `noteTypeToDivisions`, `divisionsToNoteType`, `choosePlacement`, `resolvePitchFromPlacement`, `updateTrackNotes`, `createMeasureMeta` with imports from `editor-core/helpers.ts`. Keep the exports from `scoreDocument.ts` as re-exports so existing consumers don't break.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No new errors (only the pre-existing ones from Task 1).

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/editor-core/helpers.ts client/src/lib/scoreDocument.ts
git commit -m "refactor: extract shared helpers from scoreDocument.ts to editor-core/helpers.ts"
```

---

## Task 3: Duration Validation Module

**Files:**
- Create: `client/src/spaces/pack/editor-core/validation.ts`
- Create: `client/src/spaces/pack/editor-core/validation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/spaces/pack/editor-core/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeEffectiveDuration, getMeasureCapacity, validateAndTruncate } from './validation'
import type { ScoreDocument, ScoreNoteEvent, ScoreTrack } from '@lava/shared'

const DIVISIONS = 480

function makeNote(overrides: Partial<ScoreNoteEvent>): ScoreNoteEvent {
  return {
    id: 'n1',
    measureIndex: 0,
    voice: 1,
    beat: 0,
    durationDivisions: DIVISIONS,
    durationType: 'quarter',
    dots: 0,
    isRest: false,
    pitch: { step: 'C', octave: 4 },
    placement: null,
    techniques: [],
    ...overrides,
  }
}

describe('computeEffectiveDuration', () => {
  it('returns base duration for plain note', () => {
    expect(computeEffectiveDuration(makeNote({ durationType: 'quarter', dots: 0 }), DIVISIONS)).toBe(480)
  })

  it('adds 50% for single dot', () => {
    expect(computeEffectiveDuration(makeNote({ durationType: 'quarter', dots: 1 }), DIVISIONS)).toBe(720)
  })

  it('adds 75% for double dot', () => {
    expect(computeEffectiveDuration(makeNote({ durationType: 'quarter', dots: 2 }), DIVISIONS)).toBe(840)
  })

  it('applies tuplet ratio', () => {
    const note = makeNote({ durationType: 'quarter', dots: 0, tuplet: { actual: 3, normal: 2 } })
    expect(computeEffectiveDuration(note, DIVISIONS)).toBe(320)
  })

  it('applies both dot and tuplet', () => {
    const note = makeNote({ durationType: 'quarter', dots: 1, tuplet: { actual: 3, normal: 2 } })
    expect(computeEffectiveDuration(note, DIVISIONS)).toBe(480) // 720 * 2/3
  })
})

describe('getMeasureCapacity', () => {
  it('returns 4 quarters for 4/4', () => {
    expect(getMeasureCapacity({ numerator: 4, denominator: 4 }, DIVISIONS)).toBe(1920)
  })

  it('returns 3 quarters for 3/4', () => {
    expect(getMeasureCapacity({ numerator: 3, denominator: 4 }, DIVISIONS)).toBe(1440)
  })

  it('returns 3 quarters for 6/8', () => {
    expect(getMeasureCapacity({ numerator: 6, denominator: 8 }, DIVISIONS)).toBe(1440)
  })
})

describe('validateAndTruncate', () => {
  it('truncates a note that overflows the measure', () => {
    // 4/4 bar, 3 quarter notes already, then insert a quarter at beat 3 → should truncate to fit 1 remaining beat
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0 }),
      makeNote({ id: 'n2', beat: 1 }),
      makeNote({ id: 'n3', beat: 2 }),
      makeNote({ id: 'n4', beat: 3, durationType: 'half', durationDivisions: 960 }), // half note at beat 3 → overflows
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const n4 = result.find((n) => n.id === 'n4')!
    expect(n4.durationDivisions).toBe(DIVISIONS) // truncated to quarter
    expect(n4.durationType).toBe('quarter')
  })

  it('removes notes whose beat start is beyond capacity', () => {
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0 }),
      makeNote({ id: 'n5', beat: 5 }), // beyond 4/4 capacity
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    expect(result.find((n) => n.id === 'n5')).toBeUndefined()
  })

  it('clears dots when truncating', () => {
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0, durationType: 'half', durationDivisions: 960 }),
      makeNote({ id: 'n2', beat: 2, durationType: 'half', durationDivisions: 960, dots: 1 }), // dotted half at beat 2 → 3 beats, overflows
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const n2 = result.find((n) => n.id === 'n2')!
    expect(n2.dots).toBe(0)
    expect(n2.durationDivisions).toBe(960) // half note fits (beats 2-3)
  })

  it('leaves valid measures unchanged', () => {
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0 }),
      makeNote({ id: 'n2', beat: 1 }),
      makeNote({ id: 'n3', beat: 2 }),
      makeNote({ id: 'n4', beat: 3 }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    expect(result).toHaveLength(4)
    expect(result.every((n) => n.durationDivisions === DIVISIONS)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm -F @lava/client exec vitest run client/src/spaces/pack/editor-core/validation.test.ts`

Expected: FAIL — module `./validation` not found.

- [ ] **Step 3: Implement validation.ts**

Create `client/src/spaces/pack/editor-core/validation.ts`:

```ts
import type { NoteValue, ScoreNoteEvent, TimeSignature } from '@lava/shared'
import { noteTypeToDivisions, divisionsToNoteType } from './helpers'

export function computeEffectiveDuration(note: ScoreNoteEvent, divisions: number): number {
  let base = noteTypeToDivisions(note.durationType, divisions)

  // Apply dots
  let dotValue = base
  for (let i = 0; i < note.dots; i++) {
    dotValue = Math.floor(dotValue / 2)
    base += dotValue
  }

  // Apply tuplet
  if (note.tuplet) {
    base = Math.round((base * note.tuplet.normal) / note.tuplet.actual)
  }

  return base
}

export function getMeasureCapacity(meter: TimeSignature, divisions: number): number {
  // capacity in divisions = numerator * (divisions * 4 / denominator)
  return Math.round(meter.numerator * ((divisions * 4) / meter.denominator))
}

const VALID_DURATIONS: NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']

function findClosestDurationType(targetDivisions: number, divisions: number): NoteValue {
  let best: NoteValue = 'sixteenth'
  let bestDiff = Infinity
  for (const dt of VALID_DURATIONS) {
    const d = noteTypeToDivisions(dt, divisions)
    if (d <= targetDivisions && targetDivisions - d < bestDiff) {
      bestDiff = targetDivisions - d
      best = dt
    }
  }
  return best
}

/**
 * Validate all notes in a specific measure and truncate/remove any that overflow.
 * Returns a new array of notes (does not mutate input).
 */
export function validateAndTruncate(
  allNotes: ScoreNoteEvent[],
  measureIndex: number,
  meter: TimeSignature,
  divisions: number,
): ScoreNoteEvent[] {
  const capacity = getMeasureCapacity(meter, divisions)

  const inMeasure = allNotes
    .filter((n) => n.measureIndex === measureIndex)
    .sort((a, b) => a.beat - b.beat)

  const otherNotes = allNotes.filter((n) => n.measureIndex !== measureIndex)

  const validated: ScoreNoteEvent[] = []

  for (const note of inMeasure) {
    const beatPosition = Math.round(note.beat * divisions)

    // Remove notes starting at or beyond capacity
    if (beatPosition >= capacity) continue

    const remaining = capacity - beatPosition
    const effectiveDur = computeEffectiveDuration(note, divisions)

    if (effectiveDur <= remaining) {
      // Fits — keep as-is
      validated.push(note)
    } else {
      // Truncate
      const truncatedType = findClosestDurationType(remaining, divisions)
      const truncatedDivisions = noteTypeToDivisions(truncatedType, divisions)
      validated.push({
        ...note,
        durationType: truncatedType,
        durationDivisions: truncatedDivisions,
        dots: 0, // clear dots when truncating
        tuplet: undefined, // clear tuplet when truncating
      })
    }
  }

  return [...otherNotes, ...validated]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @lava/client exec vitest run client/src/spaces/pack/editor-core/validation.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/editor-core/validation.ts client/src/spaces/pack/editor-core/validation.test.ts
git commit -m "feat(editor): add duration validation with auto-truncation"
```

---

## Task 4: Command Handlers — Note Entry

**Files:**
- Create: `client/src/spaces/pack/editor-core/handlers/noteEntry.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/noteEntry.test.ts`

Extract `insertNote`, `insertNoteAtCaret`, `insertRestAtCaret`, `deleteNote` from `scoreDocument.ts` (lines 676-790).

- [ ] **Step 1: Write failing test**

Create `client/src/spaces/pack/editor-core/handlers/noteEntry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { handleInsertNoteAtCaret, handleDeleteNote } from './noteEntry'
import type { ScoreDocument } from '@lava/shared'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'

describe('handleInsertNoteAtCaret', () => {
  it('inserts a note at the specified position', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const result = handleInsertNoteAtCaret(doc, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      string: 1,
      fret: 5,
      durationType: 'quarter',
    })
    const track = result.document.tracks[0]!
    expect(track.notes).toHaveLength(1)
    expect(track.notes[0]!.placement?.fret).toBe(5)
    expect(track.notes[0]!.durationType).toBe('quarter')
    expect(track.notes[0]!.techniques).toEqual([])
  })
})

describe('handleDeleteNote', () => {
  it('removes the note with matching id', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const afterInsert = handleInsertNoteAtCaret(doc, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      string: 1,
      fret: 5,
      durationType: 'quarter',
    })
    const noteId = afterInsert.document.tracks[0]!.notes[0]!.id
    const result = handleDeleteNote(afterInsert.document, { type: 'deleteNote', noteId })
    expect(result.document.tracks[0]!.notes).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @lava/client exec vitest run client/src/spaces/pack/editor-core/handlers/noteEntry.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement noteEntry.ts**

Create `client/src/spaces/pack/editor-core/handlers/noteEntry.ts`. Extract the logic from `scoreDocument.ts` lines 676-790, adapting to use `Technique[]` instead of `TechniqueSet`, and importing helpers from `../helpers.ts`.

Each handler function signature follows this pattern:

```ts
import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { createId, noteTypeToDivisions, choosePlacement, resolvePitchFromPlacement, cloneNote, updateTrackNotes } from '../helpers'

export function handleInsertNote(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'insertNote' }>): CommandResult {
  // ... logic extracted from scoreDocument.ts lines 676-697
  // Key change: note.techniques = [] instead of empty TechniqueSet
}

export function handleInsertNoteAtCaret(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'insertNoteAtCaret' }>): CommandResult {
  // ... logic extracted from scoreDocument.ts lines 699-751
  // Key change: note.techniques = []
}

export function handleInsertRestAtCaret(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'insertRestAtCaret' }>): CommandResult {
  // ... logic extracted from scoreDocument.ts lines 753-786
  // Key change: note.techniques = []
}

export function handleDeleteNote(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'deleteNote' }>): CommandResult {
  // ... logic extracted from scoreDocument.ts lines 788-790
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @lava/client exec vitest run client/src/spaces/pack/editor-core/handlers/noteEntry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/editor-core/handlers/noteEntry.ts client/src/spaces/pack/editor-core/handlers/noteEntry.test.ts
git commit -m "feat(editor): extract noteEntry command handlers"
```

---

## Task 5: Command Handlers — Note Properties

**Files:**
- Create: `client/src/spaces/pack/editor-core/handlers/noteProperties.ts`

Extract `setDuration`, `setPitch`, `setStringFret`, `toggleRest`, `setNoteDynamic` from `scoreDocument.ts` (lines 809-856, 896-904, 1131-1141).

- [ ] **Step 1: Implement noteProperties.ts**

```ts
import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { noteTypeToDivisions, choosePlacement, resolvePitchFromPlacement, updateTrackNotes } from '../helpers'

export function handleSetDuration(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'setDuration' }>): CommandResult { /* lines 809-819 */ }
export function handleSetPitch(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'setPitch' }>): CommandResult { /* lines 820-838 */ }
export function handleSetStringFret(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'setStringFret' }>): CommandResult { /* lines 839-856 */ }
export function handleToggleRest(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'toggleRest' }>): CommandResult { /* lines 896-904 */ }
export function handleSetNoteDynamic(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'setNoteDynamic' }>): CommandResult { /* lines 1131-1141 */ }
export function handleSimplifyFingering(doc: ScoreDocument, cmd: Extract<ScoreCommand, { type: 'simplifyFingering' }>): CommandResult { /* lines 1043-1048 */ }
```

- [ ] **Step 2: Commit**

```bash
git add client/src/spaces/pack/editor-core/handlers/noteProperties.ts
git commit -m "feat(editor): extract noteProperties command handlers"
```

---

## Task 6: Command Handlers — Techniques (New Technique[] API)

**Files:**
- Create: `client/src/spaces/pack/editor-core/handlers/techniques.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/techniques.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { handleAddTechnique, handleRemoveTechnique } from './techniques'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'
import { handleInsertNoteAtCaret } from './noteEntry'
import type { Technique } from '@lava/shared'

function docWithNote() {
  const doc = createEmptyScoreDocument()
  const trackId = doc.tracks[0]!.id
  return handleInsertNoteAtCaret(doc, {
    type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 0, string: 1, fret: 5, durationType: 'quarter',
  })
}

describe('handleAddTechnique', () => {
  it('adds a parameterized bend technique', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const technique: Technique = { type: 'bend', style: 'full', semitones: 2 }
    const result = handleAddTechnique(document, { type: 'addTechnique', noteId, technique })
    const note = result.document.tracks[0]!.notes[0]!
    expect(note.techniques).toHaveLength(1)
    expect(note.techniques[0]).toEqual({ type: 'bend', style: 'full', semitones: 2 })
  })

  it('replaces existing technique of same type', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleAddTechnique(document, { type: 'addTechnique', noteId, technique: { type: 'bend', style: 'full', semitones: 1 } })
    const r2 = handleAddTechnique(r1.document, { type: 'addTechnique', noteId, technique: { type: 'bend', style: 'half', semitones: 0.5 } })
    const note = r2.document.tracks[0]!.notes[0]!
    expect(note.techniques).toHaveLength(1)
    expect(note.techniques[0]).toEqual({ type: 'bend', style: 'half', semitones: 0.5 })
  })
})

describe('handleRemoveTechnique', () => {
  it('removes a technique by type', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleAddTechnique(document, { type: 'addTechnique', noteId, technique: { type: 'palmMute' } })
    const r2 = handleRemoveTechnique(r1.document, { type: 'removeTechnique', noteId, techniqueType: 'palmMute' })
    expect(r2.document.tracks[0]!.notes[0]!.techniques).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F @lava/client exec vitest run client/src/spaces/pack/editor-core/handlers/techniques.test.ts`

- [ ] **Step 3: Implement techniques.ts**

```ts
import type { CommandResult, ScoreCommand, ScoreDocument, Technique } from '@lava/shared'

export function handleAddTechnique(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'addTechnique' }>,
): CommandResult {
  const next = structuredClone(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      // Remove existing technique of same type, then add new one
      note.techniques = note.techniques.filter((t) => t.type !== cmd.technique.type)
      note.techniques.push(cmd.technique)
      break
    }
  }
  return { document: next, warnings: [] }
}

export function handleRemoveTechnique(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'removeTechnique' }>,
): CommandResult {
  const next = structuredClone(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      note.techniques = note.techniques.filter((t) => t.type !== cmd.techniqueType)
      break
    }
  }
  return { document: next, warnings: [] }
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/editor-core/handlers/techniques.ts client/src/spaces/pack/editor-core/handlers/techniques.test.ts
git commit -m "feat(editor): add technique handlers with parameterized Technique[] API"
```

---

## Task 7: Command Handlers — Notation (toggleDot, toggleTuplet)

**Files:**
- Create: `client/src/spaces/pack/editor-core/handlers/notation.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/notation.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { handleToggleDot, handleToggleTuplet, handleToggleTie, handleToggleSlur } from './notation'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'
import { handleInsertNoteAtCaret } from './noteEntry'

function docWithNote() {
  const doc = createEmptyScoreDocument()
  const trackId = doc.tracks[0]!.id
  return handleInsertNoteAtCaret(doc, {
    type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 0, string: 1, fret: 5, durationType: 'quarter',
  })
}

describe('handleToggleDot', () => {
  it('cycles dots 0 → 1 → 2 → 0', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id

    const r1 = handleToggleDot(document, { type: 'toggleDot', noteId })
    expect(r1.document.tracks[0]!.notes[0]!.dots).toBe(1)

    const r2 = handleToggleDot(r1.document, { type: 'toggleDot', noteId })
    expect(r2.document.tracks[0]!.notes[0]!.dots).toBe(2)

    const r3 = handleToggleDot(r2.document, { type: 'toggleDot', noteId })
    expect(r3.document.tracks[0]!.notes[0]!.dots).toBe(0)
  })
})

describe('handleToggleTuplet', () => {
  it('adds triplet when not present', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const result = handleToggleTuplet(document, { type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
    expect(result.document.tracks[0]!.notes[0]!.tuplet).toEqual({ actual: 3, normal: 2 })
  })

  it('removes tuplet when already present', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleToggleTuplet(document, { type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
    const r2 = handleToggleTuplet(r1.document, { type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
    expect(r2.document.tracks[0]!.notes[0]!.tuplet).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify failure, implement, verify pass**

Implement `notation.ts` with `handleToggleDot`, `handleToggleTuplet`, `handleToggleTie` (extracted from scoreDocument.ts lines 906-909), and `handleToggleSlur` (lines 911-914).

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/editor-core/handlers/notation.ts client/src/spaces/pack/editor-core/handlers/notation.test.ts
git commit -m "feat(editor): add notation handlers — toggleDot, toggleTuplet, toggleTie, toggleSlur"
```

---

## Task 8: Command Handlers — Remaining Handlers

**Files:**
- Create: `client/src/spaces/pack/editor-core/handlers/noteMutation.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/measures.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/scoreMeta.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/measureMeta.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/measureMeta.test.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/lyrics.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/clipboard.ts`
- Create: `client/src/spaces/pack/editor-core/handlers/clipboard.test.ts`

- [ ] **Step 1: noteMutation.ts**

Extract `splitNote` (lines 857-874), `mergeWithNext` (lines 876-894), `moveNoteToBeat` (lines 791-808), `transposeSelection` (lines 916-941) from `scoreDocument.ts`.

- [ ] **Step 2: measures.ts**

Extract `addMeasureBefore` (lines 1015-1027), `addMeasureAfter` (lines 1029-1041), `deleteMeasureRange` (lines 996-1013) from `scoreDocument.ts`.

- [ ] **Step 3: scoreMeta.ts**

Extract `setTempo`, `setKeySignature`, `setTimeSignature`, `setTrackClef`, `setCapo`, `changeTuning` from `scoreDocument.ts` (lines 943-958, 1086-1130).

- [ ] **Step 4: measureMeta.ts with tests — including new per-measure commands**

Write test for new `setMeasureTimeSignature` and `setMeasureKeySignature`:

```ts
import { describe, it, expect } from 'vitest'
import { handleSetMeasureTimeSignature, handleSetMeasureKeySignature } from './measureMeta'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'

describe('handleSetMeasureTimeSignature', () => {
  it('sets time signature on a specific measure', () => {
    const doc = createEmptyScoreDocument()
    // Ensure we have at least 2 measures
    const result = handleSetMeasureTimeSignature(doc, {
      type: 'setMeasureTimeSignature',
      measureIndex: 0,
      timeSignature: { numerator: 3, denominator: 4 },
    })
    expect(result.document.measures[0]!.timeSignature).toEqual({ numerator: 3, denominator: 4 })
  })
})
```

Also extract existing handlers: `setBarlineType`, `setRepeat`, `setRepeatMarker`, `setChordSymbol`, `setAnnotation`, `setSectionLabel`, `setChordDiagramPlacement`, `reharmonizeSelection` from `scoreDocument.ts`.

- [ ] **Step 5: lyrics.ts**

```ts
import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'

export function handleSetLyric(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setLyric' }>,
): CommandResult {
  const next = structuredClone(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      note.lyric = cmd.text || undefined
      break
    }
  }
  return { document: next, warnings: [] }
}
```

- [ ] **Step 6: clipboard.ts with tests**

```ts
import type { CommandResult, ScoreCommand, ScoreDocument, ScoreClipboard } from '@lava/shared'
import { createId, noteTypeToDivisions } from '../helpers'

export function handlePasteSelection(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'pasteSelection' }>,
): CommandResult {
  const next = structuredClone(doc)
  const track = next.tracks.find((t) => t.id === cmd.targetTrackId)
  if (!track) return { document: next, warnings: ['Track not found'] }

  const { clipboard } = cmd

  // Ensure enough measures exist
  const neededMeasures = cmd.targetMeasureIndex + clipboard.sourceMeasureCount
  while (next.measures.length < neededMeasures) {
    const idx = next.measures.length
    next.measures.push({
      id: createId(),
      index: idx,
      harmony: [],
      annotations: [],
    })
  }

  // Insert clipboard notes with offset
  for (const clipNote of clipboard.notes) {
    const newNote = {
      ...clipNote,
      id: createId(),
      measureIndex: cmd.targetMeasureIndex + clipNote.measureIndex,
      beat: clipNote.measureIndex === 0 ? cmd.targetBeat + clipNote.beat : clipNote.beat,
      techniques: clipNote.techniques.map((t) => ({ ...t })),
    }
    track.notes.push(newNote)
  }

  // Copy measure metadata (chords, annotations)
  for (const clipMeta of clipboard.measures) {
    const targetIdx = cmd.targetMeasureIndex + clipMeta.index
    const targetMeta = next.measures[targetIdx]
    if (targetMeta) {
      targetMeta.harmony = [...clipMeta.harmony]
      targetMeta.annotations = [...clipMeta.annotations]
    }
  }

  // Sort notes
  track.notes.sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)

  return { document: next, warnings: [] }
}
```

- [ ] **Step 7: Run all handler tests**

Run: `pnpm -F @lava/client exec vitest run client/src/spaces/pack/editor-core/handlers/`

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/spaces/pack/editor-core/handlers/
git commit -m "feat(editor): extract all remaining command handlers — noteMutation, measures, scoreMeta, measureMeta, lyrics, clipboard"
```

---

## Task 9: Command Router

**Files:**
- Create: `client/src/spaces/pack/editor-core/commandRouter.ts`
- Create: `client/src/spaces/pack/editor-core/commandRouter.test.ts`
- Modify: `client/src/stores/scoreDocumentStore.ts`
- Modify: `client/src/lib/scoreDocument.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import { applyCommandToDocument } from './commandRouter'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'

describe('applyCommandToDocument (router)', () => {
  it('dispatches insertNoteAtCaret and returns valid result', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const result = applyCommandToDocument(doc, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      string: 1,
      fret: 5,
      durationType: 'quarter',
    })
    expect(result.document.tracks[0]!.notes).toHaveLength(1)
  })

  it('runs validation after insertNoteAtCaret — truncates overflow', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id

    // Insert 4 quarter notes (fills 4/4 bar)
    let current = doc
    for (let beat = 0; beat < 4; beat++) {
      const r = applyCommandToDocument(current, {
        type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat, string: 1, fret: 5, durationType: 'quarter',
      })
      current = r.document
    }

    // Insert a half note at beat 3 — should be truncated to quarter
    const r = applyCommandToDocument(current, {
      type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 3, string: 2, fret: 7, durationType: 'half',
    })
    const notesAtBeat3 = r.document.tracks[0]!.notes.filter((n) => n.beat === 3)
    // The half note should have been truncated
    for (const n of notesAtBeat3) {
      expect(n.durationDivisions).toBeLessThanOrEqual(doc.divisions) // <= 1 quarter
    }
  })

  it('returns warnings for unknown command type', () => {
    const doc = createEmptyScoreDocument()
    const result = applyCommandToDocument(doc, { type: 'nonExistent' } as any)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Implement commandRouter.ts**

```ts
import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { validateAndTruncate } from './validation'
import { getEffectiveTimeSignature } from './helpers'

// Import all handlers
import { handleInsertNote, handleInsertNoteAtCaret, handleInsertRestAtCaret, handleDeleteNote } from './handlers/noteEntry'
import { handleSetDuration, handleSetPitch, handleSetStringFret, handleToggleRest, handleSetNoteDynamic, handleSimplifyFingering } from './handlers/noteProperties'
import { handleAddTechnique, handleRemoveTechnique } from './handlers/techniques'
import { handleSplitNote, handleMergeWithNext, handleMoveNoteToBeat, handleTransposeSelection } from './handlers/noteMutation'
import { handleToggleTie, handleToggleSlur, handleToggleDot, handleToggleTuplet } from './handlers/notation'
import { handleAddMeasureBefore, handleAddMeasureAfter, handleDeleteMeasureRange } from './handlers/measures'
import { handleSetTempo, handleSetKeySignature, handleSetTimeSignature, handleSetTrackClef, handleSetCapo, handleChangeTuning } from './handlers/scoreMeta'
import {
  handleSetMeasureTimeSignature, handleSetMeasureKeySignature,
  handleSetBarlineType, handleSetRepeat, handleSetRepeatMarker,
  handleSetChordSymbol, handleSetAnnotation, handleSetSectionLabel,
  handleSetChordDiagramPlacement, handleReharmonizeSelection,
} from './handlers/measureMeta'
import { handleSetLyric } from './handlers/lyrics'
import { handlePasteSelection } from './handlers/clipboard'

type Handler = (doc: ScoreDocument, cmd: any) => CommandResult

const HANDLER_MAP: Record<string, Handler> = {
  insertNote: handleInsertNote,
  insertNoteAtCaret: handleInsertNoteAtCaret,
  insertRestAtCaret: handleInsertRestAtCaret,
  deleteNote: handleDeleteNote,
  setDuration: handleSetDuration,
  setPitch: handleSetPitch,
  setStringFret: handleSetStringFret,
  toggleRest: handleToggleRest,
  setNoteDynamic: handleSetNoteDynamic,
  addTechnique: handleAddTechnique,
  removeTechnique: handleRemoveTechnique,
  splitNote: handleSplitNote,
  mergeWithNext: handleMergeWithNext,
  moveNoteToBeat: handleMoveNoteToBeat,
  transposeSelection: handleTransposeSelection,
  toggleTie: handleToggleTie,
  toggleSlur: handleToggleSlur,
  toggleDot: handleToggleDot,
  toggleTuplet: handleToggleTuplet,
  addMeasureBefore: handleAddMeasureBefore,
  addMeasureAfter: handleAddMeasureAfter,
  deleteMeasureRange: handleDeleteMeasureRange,
  setTempo: handleSetTempo,
  setKeySignature: handleSetKeySignature,
  setTimeSignature: handleSetTimeSignature,
  setTrackClef: handleSetTrackClef,
  setCapo: handleSetCapo,
  setTuning: handleChangeTuning,
  changeTuning: handleChangeTuning,
  setMeasureTimeSignature: handleSetMeasureTimeSignature,
  setMeasureKeySignature: handleSetMeasureKeySignature,
  setBarlineType: handleSetBarlineType,
  setRepeat: handleSetRepeat,
  setRepeatMarker: handleSetRepeatMarker,
  setChordSymbol: handleSetChordSymbol,
  setAnnotation: handleSetAnnotation,
  setSectionLabel: handleSetSectionLabel,
  setChordDiagramPlacement: handleSetChordDiagramPlacement,
  reharmonizeSelection: handleReharmonizeSelection,
  simplifyFingering: handleSimplifyFingering,
  setLyric: handleSetLyric,
  pasteSelection: handlePasteSelection,
  // No-op commands (UI-only, handled by store)
  moveCursor: (doc) => ({ document: doc, warnings: [] }),
  selectNotes: (doc) => ({ document: doc, warnings: [] }),
  setMeasureRange: (doc) => ({ document: doc, warnings: [] }),
}

const COMMANDS_NEEDING_VALIDATION = new Set([
  'insertNoteAtCaret',
  'insertRestAtCaret',
  'setDuration',
  'splitNote',
  'setMeasureTimeSignature',
  'toggleDot',
  'toggleTuplet',
  'pasteSelection',
])

export function applyCommandToDocument(
  doc: ScoreDocument,
  cmd: ScoreCommand,
): CommandResult {
  const handler = HANDLER_MAP[cmd.type]
  if (!handler) {
    return { document: doc, warnings: [`Unknown command: ${cmd.type}`] }
  }

  const result = handler(doc, cmd)

  if (COMMANDS_NEEDING_VALIDATION.has(cmd.type)) {
    // Determine which measure(s) to validate
    const measureIndex = 'measureIndex' in cmd ? (cmd as any).measureIndex : undefined
    if (measureIndex !== undefined) {
      const meter = getEffectiveTimeSignature(result.document, measureIndex)
      for (const track of result.document.tracks) {
        track.notes = validateAndTruncate(track.notes, measureIndex, meter, result.document.divisions)
      }
    }
  }

  return result
}
```

- [ ] **Step 3: Run router tests**

Run: `pnpm -F @lava/client exec vitest run client/src/spaces/pack/editor-core/commandRouter.test.ts`

Expected: PASS.

- [ ] **Step 4: Update scoreDocumentStore.ts to use commandRouter**

In `client/src/stores/scoreDocumentStore.ts` line 3, change the import:

```ts
// Before:
import { applyCommandPatch, applyCommandToDocument, ... } from '@/lib/scoreDocument'

// After:
import { applyCommandPatch, ... } from '@/lib/scoreDocument'
import { applyCommandToDocument } from '@/spaces/pack/editor-core/commandRouter'
```

- [ ] **Step 5: Remove applyCommandToDocument from scoreDocument.ts**

In `scoreDocument.ts`, remove the entire `applyCommandToDocument` function (lines 666-1146) and its export. Keep `applyCommandPatch` and all other functions. Add a comment:

```ts
// Command handling has moved to editor-core/commandRouter.ts
// This file retains: document creation, MusicXML import/export, and utility functions.
```

- [ ] **Step 6: Run full typecheck and tests**

Run: `pnpm typecheck && pnpm -F @lava/client exec vitest run`

Fix any remaining type errors from the migration.

- [ ] **Step 7: Commit**

```bash
git add client/src/spaces/pack/editor-core/commandRouter.ts client/src/spaces/pack/editor-core/commandRouter.test.ts client/src/stores/scoreDocumentStore.ts client/src/lib/scoreDocument.ts
git commit -m "feat(editor): add commandRouter with post-validation, wire into scoreDocumentStore"
```

---

## Task 10: Toolbar Bridge — Wire Orphaned Events

**Files:**
- Create: `client/src/spaces/pack/editor-core/toolbarBridge.ts`
- Modify: `client/src/spaces/pack/EditorPage.tsx`

- [ ] **Step 1: Implement toolbarBridge.ts**

```ts
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import { useEditorStore } from '@/stores/editorStore'
import type { ScoreCommand, ScoreClipboard, ScoreNoteEvent } from '@lava/shared'

function getSelectedNoteId(): string | null {
  const { selectedNoteIds } = useEditorStore.getState()
  return selectedNoteIds[0] ?? null
}

function getSelectedNotes(): ScoreNoteEvent[] {
  const { selectedNoteIds } = useEditorStore.getState()
  const { document } = useScoreDocumentStore.getState()
  const allNotes = document.tracks.flatMap((t) => t.notes)
  return allNotes.filter((n) => selectedNoteIds.includes(n.id))
}

function applyCommand(cmd: ScoreCommand) {
  useScoreDocumentStore.getState().applyCommand(cmd)
}

const EVENT_HANDLERS: Record<string, (e: CustomEvent) => void> = {
  'lava-accidental': (e) => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    const { document } = useScoreDocumentStore.getState()
    const note = document.tracks.flatMap((t) => t.notes).find((n) => n.id === noteId)
    if (!note?.pitch) return
    applyCommand({
      type: 'setPitch',
      noteId,
      pitch: { ...note.pitch, alter: e.detail.alter },
    })
  },

  'lava-dynamic': (e) => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    applyCommand({ type: 'setNoteDynamic', noteId, dynamic: e.detail.dynamic })
  },

  'lava-toggle-dot': () => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    applyCommand({ type: 'toggleDot', noteId })
  },

  'lava-toggle-triplet': () => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    applyCommand({ type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
  },

  'lava-transpose': (e) => {
    const { selectedBars } = useEditorStore.getState()
    if (selectedBars.length === 0) return
    applyCommand({
      type: 'transposeSelection',
      startMeasure: Math.min(...selectedBars),
      endMeasure: Math.max(...selectedBars),
      semitones: e.detail.semitones,
    })
  },

  'lava-copy': () => {
    const { selectedBars, selectedNoteIds, setClipboard } = useEditorStore.getState()
    const { document } = useScoreDocumentStore.getState()

    if (selectedBars.length > 0) {
      const minBar = Math.min(...selectedBars)
      const notes = document.tracks.flatMap((t) => t.notes)
        .filter((n) => selectedBars.includes(n.measureIndex))
        .map((n) => ({ ...n, measureIndex: n.measureIndex - minBar }))
      const measures = selectedBars.map((i) => ({ ...document.measures[i]!, index: i - minBar }))
      setClipboard({ notes, measures, sourceMeasureCount: selectedBars.length })
    } else if (selectedNoteIds.length > 0) {
      const notes = document.tracks.flatMap((t) => t.notes).filter((n) => selectedNoteIds.includes(n.id))
      setClipboard({ notes, measures: [], sourceMeasureCount: 1 })
    }
  },

  'lava-paste': () => {
    const { clipboard, caret } = useEditorStore.getState()
    if (!clipboard || !caret) return
    applyCommand({
      type: 'pasteSelection',
      targetTrackId: caret.trackId,
      targetMeasureIndex: caret.measureIndex,
      targetBeat: caret.beat,
      clipboard,
    })
  },

  'lava-duplicate': () => {
    // Trigger copy then paste at next measure
    EVENT_HANDLERS['lava-copy']!(new CustomEvent('lava-copy'))
    const { clipboard, caret } = useEditorStore.getState()
    const { selectedBars } = useEditorStore.getState()
    if (!clipboard) return
    const targetMeasure = selectedBars.length > 0
      ? Math.max(...selectedBars) + 1
      : (caret?.measureIndex ?? 0) + 1
    const trackId = caret?.trackId ?? useScoreDocumentStore.getState().document.tracks[0]?.id
    if (!trackId) return
    applyCommand({
      type: 'pasteSelection',
      targetTrackId: trackId,
      targetMeasureIndex: targetMeasure,
      targetBeat: 0,
      clipboard,
    })
  },

  'lava-open-fretboard': () => {
    useEditorStore.getState().requestInspectorFocus('fretboard')
  },

  'lava-open-duration': () => {
    useEditorStore.getState().requestInspectorFocus('duration')
  },
}

export function registerToolbarBridge(): () => void {
  const entries = Object.entries(EVENT_HANDLERS)
  for (const [event, handler] of entries) {
    window.addEventListener(event, handler as EventListener)
  }
  return () => {
    for (const [event, handler] of entries) {
      window.removeEventListener(event, handler as EventListener)
    }
  }
}
```

- [ ] **Step 2: Register in EditorPage.tsx**

In `client/src/spaces/pack/EditorPage.tsx`, add after the existing `useEffect` hooks (around line 373):

```ts
import { registerToolbarBridge } from '@/spaces/pack/editor-core/toolbarBridge'

// Inside the component:
useEffect(() => {
  const cleanup = registerToolbarBridge()
  return cleanup
}, [])
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/editor-core/toolbarBridge.ts client/src/spaces/pack/EditorPage.tsx
git commit -m "feat(editor): add toolbarBridge — wire all orphaned custom events to commands"
```

---

## Task 11: Update editorStore for ScoreClipboard + Lyric Editing

**Files:**
- Modify: `client/src/stores/editorStore.ts`

- [ ] **Step 1: Change clipboard type and add lyric state**

In `editorStore.ts`, update the interface (around line 80):

```ts
// Before:
clipboard: string | null
setClipboard: (fragment: string | null) => void

// After:
clipboard: ScoreClipboard | null
setClipboard: (clipboard: ScoreClipboard | null) => void
lyricEditingNoteId: string | null
setLyricEditingNoteId: (noteId: string | null) => void
```

Add the import: `import type { ScoreClipboard } from '@lava/shared'`

Update the store implementation to match.

- [ ] **Step 2: Commit**

```bash
git add client/src/stores/editorStore.ts
git commit -m "feat(editor): update editorStore — ScoreClipboard type, lyric editing state"
```

---

## Task 12: Keyboard Shortcut Fixes

**Files:**
- Modify: `client/src/hooks/useEditorKeyboard.ts`

- [ ] **Step 1: Reassign L and Shift+L**

Find the `L` key handler (around line 370 in useEditorKeyboard.ts). Change:

```ts
// Before: L → toggleTie
// After: L → open lyric editing
// Shift+L → toggleTie

case 'l':
  if (e.shiftKey) {
    // Toggle tie (was previously plain L)
    window.dispatchEvent(new CustomEvent('lava-toggle-tie'))
  } else {
    // Open lyric input on selected note
    const noteId = selectedNoteIds[0]
    if (noteId) {
      useEditorStore.getState().setLyricEditingNoteId(noteId)
    }
  }
  e.preventDefault()
  break
```

- [ ] **Step 2: Verify all dispatched events have bridge handlers**

Cross-reference every `window.dispatchEvent(new CustomEvent('lava-*'))` call in `useEditorKeyboard.ts` against the `EVENT_HANDLERS` in `toolbarBridge.ts`. Ensure all are covered. Events that should be verified:
- `lava-copy` ✓
- `lava-paste` ✓
- `lava-duplicate` ✓
- `lava-transpose` ✓
- `lava-toggle-dot` ✓
- `lava-toggle-triplet` ✓
- `lava-accidental` ✓
- `lava-open-fretboard` ✓
- `lava-open-duration` ✓

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useEditorKeyboard.ts
git commit -m "fix(editor): fix keyboard shortcuts — reassign L to lyric, wire all orphaned events"
```

---

## Task 13: Technique Definitions Registry

**Files:**
- Create: `client/src/spaces/pack/editor-core/techniqueDefinitions.ts`

- [ ] **Step 1: Create the data-driven registry**

```ts
export interface TechniqueParamDef {
  key: string
  kind: 'select' | 'number'
  options?: string[]
  min?: number
  max?: number
  step?: number
  default: string | number
}

export interface TechniqueDef {
  type: string
  label: string
  icon: string
  group: string
  params: TechniqueParamDef[]
}

export const GROUP_LABELS: Record<string, string> = {
  bend: 'Bend',
  slide: 'Slide',
  legato: 'Legato',
  mute: 'Mute',
  harmonic: 'Harmonic',
  expression: 'Expression',
  tremolo: 'Tremolo',
  stroke: 'Stroke',
  articulation: 'Articulation',
  sustain: 'Sustain',
}

export const TECHNIQUE_DEFS: TechniqueDef[] = [
  { type: 'bend', label: 'Bend', icon: 'ArrowUpFromLine', group: 'bend', params: [
    { key: 'style', kind: 'select', options: ['full', 'half', 'pre-bend', 'bend-release'], default: 'full' },
    { key: 'semitones', kind: 'number', min: 0.5, max: 4, step: 0.5, default: 2 },
  ]},
  { type: 'slide', label: 'Slide', icon: 'MoveRight', group: 'slide', params: [
    { key: 'style', kind: 'select', options: ['shift', 'legato', 'in-above', 'in-below', 'out-up', 'out-down'], default: 'shift' },
  ]},
  { type: 'hammerOn', label: 'Hammer-On', icon: 'ArrowDown', group: 'legato', params: [] },
  { type: 'pullOff', label: 'Pull-Off', icon: 'ArrowUp', group: 'legato', params: [] },
  { type: 'tap', label: 'Tapping', icon: 'Hand', group: 'legato', params: [] },
  { type: 'ghostNote', label: 'Ghost Note', icon: 'Parentheses', group: 'mute', params: [] },
  { type: 'deadNote', label: 'Dead Note', icon: 'X', group: 'mute', params: [] },
  { type: 'palmMute', label: 'Palm Mute', icon: 'HandMetal', group: 'mute', params: [] },
  { type: 'harmonic', label: 'Harmonic', icon: 'Sparkles', group: 'harmonic', params: [
    { key: 'style', kind: 'select', options: ['natural', 'pinch', 'tap', 'artificial'], default: 'natural' },
  ]},
  { type: 'vibrato', label: 'Vibrato', icon: 'Activity', group: 'expression', params: [
    { key: 'style', kind: 'select', options: ['normal', 'wide'], default: 'normal' },
  ]},
  { type: 'tremoloPicking', label: 'Tremolo Pick', icon: 'Zap', group: 'tremolo', params: [
    { key: 'speed', kind: 'select', options: ['eighth', 'sixteenth', 'thirtySecond'], default: 'sixteenth' },
  ]},
  { type: 'tremoloBar', label: 'Tremolo Bar', icon: 'TrendingDown', group: 'tremolo', params: [
    { key: 'semitones', kind: 'number', min: 0.5, max: 12, step: 0.5, default: 2 },
  ]},
  { type: 'pickStroke', label: 'Pick Stroke', icon: 'ChevronsUp', group: 'stroke', params: [
    { key: 'direction', kind: 'select', options: ['up', 'down'], default: 'down' },
  ]},
  { type: 'arpeggio', label: 'Arpeggio', icon: 'ListMusic', group: 'stroke', params: [
    { key: 'direction', kind: 'select', options: ['up', 'down'], default: 'up' },
  ]},
  { type: 'accent', label: 'Accent', icon: 'ChevronUp', group: 'articulation', params: [
    { key: 'style', kind: 'select', options: ['normal', 'heavy'], default: 'normal' },
  ]},
  { type: 'staccato', label: 'Staccato', icon: 'Circle', group: 'articulation', params: [] },
  { type: 'tenuto', label: 'Tenuto', icon: 'Minus', group: 'articulation', params: [] },
  { type: 'letRing', label: 'Let Ring', icon: 'BellRing', group: 'sustain', params: [] },
  { type: 'fadeIn', label: 'Fade In', icon: 'Volume1', group: 'sustain', params: [] },
]
```

- [ ] **Step 2: Commit**

```bash
git add client/src/spaces/pack/editor-core/techniqueDefinitions.ts
git commit -m "feat(editor): add data-driven technique definitions registry"
```

---

## Task 14: TechniquePanel Component

**Files:**
- Create: `client/src/components/ui/TechniquePanel.tsx`

- [ ] **Step 1: Implement TechniquePanel**

```tsx
import { useState } from 'react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui/Button'
import type { Technique } from '@lava/shared'
import type { TechniqueDef, TechniqueParamDef } from '@/spaces/pack/editor-core/techniqueDefinitions'

interface TechniquePanelProps {
  def: TechniqueDef
  activeTechnique: Technique | undefined
  onApply: (technique: Technique) => void
  onRemove: (type: string) => void
  className?: string
}

function getIcon(name: string) {
  return (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? LucideIcons.HelpCircle
}

export function TechniquePanel({ def, activeTechnique, onApply, onRemove, className }: TechniquePanelProps) {
  const isActive = !!activeTechnique
  const [params, setParams] = useState<Record<string, string | number>>(() => {
    const defaults: Record<string, string | number> = {}
    for (const p of def.params) {
      defaults[p.key] = activeTechnique ? (activeTechnique as Record<string, any>)[p.key] ?? p.default : p.default
    }
    return defaults
  })

  const Icon = getIcon(def.icon)

  function handleToggle() {
    if (isActive) {
      onRemove(def.type)
    } else {
      const technique = { type: def.type, ...params } as Technique
      onApply(technique)
    }
  }

  function handleParamChange(key: string, value: string | number) {
    const next = { ...params, [key]: value }
    setParams(next)
    if (isActive) {
      // Re-apply with new params
      const technique = { type: def.type, ...next } as Technique
      onApply(technique)
    }
  }

  if (def.params.length === 0) {
    // Simple toggle button
    return (
      <Button
        variant={isActive ? 'default' : 'ghost'}
        size="icon-sm"
        onClick={handleToggle}
        className={className}
        title={def.label}
      >
        <Icon className="size-4" />
      </Button>
    )
  }

  // Button + popover with params
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button
        variant={isActive ? 'default' : 'ghost'}
        size="sm"
        onClick={handleToggle}
        className="gap-1.5"
      >
        <Icon className="size-4" />
        <span className="text-xs">{def.label}</span>
      </Button>
      {def.params.map((p) => (
        <ParamControl key={p.key} param={p} value={params[p.key]!} onChange={(v) => handleParamChange(p.key, v)} />
      ))}
    </div>
  )
}

function ParamControl({ param, value, onChange }: { param: TechniqueParamDef; value: string | number; onChange: (v: string | number) => void }) {
  if (param.kind === 'select') {
    return (
      <select
        className="rounded bg-surface-2 border border-border px-1.5 py-0.5 text-xs text-text-primary"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      >
        {param.options!.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      type="number"
      className="w-16 rounded bg-surface-2 border border-border px-1.5 py-0.5 text-xs text-text-primary"
      min={param.min}
      max={param.max}
      step={param.step}
      value={value as number}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}
```

- [ ] **Step 2: Export from ui barrel**

Add to `client/src/components/ui/index.ts`:

```ts
export { TechniquePanel } from './TechniquePanel'
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ui/TechniquePanel.tsx client/src/components/ui/index.ts
git commit -m "feat(ui): add data-driven TechniquePanel component"
```

---

## Task 15: EditorToolbar Refactor — Data-Driven Technique Panels

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Replace hardcoded TECHNIQUE_OPTIONS with data-driven rendering**

In `EditorToolbar.tsx`, remove the old `TECHNIQUE_OPTIONS` array (lines 120-127) and the old technique button rendering in the notation panel (lines 624-633).

Replace with data-driven rendering using `TECHNIQUE_DEFS` and `TechniquePanel`:

```tsx
import { TECHNIQUE_DEFS, GROUP_LABELS } from '@/spaces/pack/editor-core/techniqueDefinitions'
import { TechniquePanel } from '@/components/ui/TechniquePanel'
import type { Technique } from '@lava/shared'

// Inside the component, in Row 2:
function TechniqueToolbarSection() {
  const { applyCommand } = useScoreDocumentStore()
  const primarySelectedNote = /* get from store */

  const activeTechniques = primarySelectedNote?.techniques ?? []

  const groups = Object.entries(
    TECHNIQUE_DEFS.reduce<Record<string, typeof TECHNIQUE_DEFS>>((acc, def) => {
      const g = acc[def.group] ?? []
      g.push(def)
      acc[def.group] = g
      return acc
    }, {})
  )

  return (
    <>
      {groups.map(([group, defs]) => (
        <div key={group} className="flex items-center gap-0.5 border-r border-border pr-2 mr-2 last:border-r-0">
          {defs.map((def) => {
            const active = activeTechniques.find((t) => t.type === def.type)
            return (
              <TechniquePanel
                key={def.type}
                def={def}
                activeTechnique={active}
                onApply={(technique) => {
                  if (!primarySelectedNote) return
                  applyCommand({ type: 'addTechnique', noteId: primarySelectedNote.id, technique })
                }}
                onRemove={(type) => {
                  if (!primarySelectedNote) return
                  applyCommand({ type: 'removeTechnique', noteId: primarySelectedNote.id, techniqueType: type })
                }}
              />
            )
          })}
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Add Row 1 tools (Dot, Tuplet, Accidental, Dynamic, Lyric)**

In Row 1 of the toolbar, add buttons for:
- **Dot:** Button that dispatches `lava-toggle-dot`
- **Tuplet:** Button that dispatches `lava-toggle-triplet`
- **Accidental:** Sharp/Flat/Natural buttons (existing panel, already wired via bridge)
- **Dynamic:** pp–ff buttons (existing panel, already wired via bridge)
- **Lyric:** Button that sets `lyricEditingNoteId` on the selected note

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat(editor): refactor toolbar with data-driven technique panels"
```

---

## Task 16: MusicXML Export — New Techniques + Tuplet + Lyrics

**Files:**
- Modify: `client/src/lib/scoreDocument.ts` (the `exportScoreDocumentToMusicXml` function, lines 523-624)

- [ ] **Step 1: Update renderNote to handle Technique[]**

In the `renderNote` helper (lines 473-516), replace the old `TechniqueSet` boolean checks with iteration over `Technique[]`:

```ts
function renderNote(note: ScoreNoteEvent, divisions: number): string {
  let xml = ''

  // ... existing pitch/duration rendering ...

  // Dots
  for (let i = 0; i < note.dots; i++) {
    xml += '        <dot/>\n'
  }

  // Tuplet
  if (note.tuplet) {
    xml += `        <time-modification>\n`
    xml += `          <actual-notes>${note.tuplet.actual}</actual-notes>\n`
    xml += `          <normal-notes>${note.tuplet.normal}</normal-notes>\n`
    xml += `        </time-modification>\n`
  }

  // Notehead for ghost/dead notes
  const ghostNote = note.techniques.find((t) => t.type === 'ghostNote')
  const deadNote = note.techniques.find((t) => t.type === 'deadNote')
  if (deadNote) {
    xml += '        <notehead>x</notehead>\n'
  } else if (ghostNote) {
    xml += '        <notehead parentheses="yes">normal</notehead>\n'
  }

  // Notations block
  const notations: string[] = []

  // Ties
  if (note.tieStart) notations.push('<tied type="start"/>')
  if (note.tieStop) notations.push('<tied type="stop"/>')

  // Tuplet bracket
  if (note.tuplet) notations.push('<tuplet type="start"/>')

  // Slur
  if (note.slurStart) notations.push('<slur type="start"/>')

  // Ornaments
  const ornaments: string[] = []
  for (const t of note.techniques) {
    if (t.type === 'tremoloPicking') {
      const val = t.speed === 'thirtySecond' ? 3 : t.speed === 'sixteenth' ? 2 : 1
      ornaments.push(`<tremolo>${val}</tremolo>`)
    }
    if (t.type === 'vibrato') {
      ornaments.push('<wavy-line type="start"/>')
    }
  }
  if (ornaments.length) notations.push(`<ornaments>${ornaments.join('')}</ornaments>`)

  // Technical
  const technical: string[] = []
  for (const t of note.techniques) {
    if (t.type === 'bend') technical.push(`<bend><bend-alter>${t.semitones}</bend-alter></bend>`)
    if (t.type === 'slide') technical.push('<slide type="start"/>')
    if (t.type === 'hammerOn') technical.push('<hammer-on type="start">H</hammer-on>')
    if (t.type === 'pullOff') technical.push('<pull-off type="start">P</pull-off>')
    if (t.type === 'tap') technical.push('<tap/>')
    if (t.type === 'harmonic') technical.push(t.style === 'natural' ? '<harmonic><natural/></harmonic>' : '<harmonic><artificial/></harmonic>')
    if (t.type === 'letRing') technical.push('<let-ring/>')
    if (t.type === 'palmMute') technical.push('<palm-mute/>')
    if (t.type === 'tremoloBar') technical.push(`<bend><bend-alter>${-t.semitones}</bend-alter></bend>`)
  }
  if (technical.length) notations.push(`<technical>${technical.join('')}</technical>`)

  // Articulations
  const articulations: string[] = []
  for (const t of note.techniques) {
    if (t.type === 'accent') articulations.push(t.style === 'heavy' ? '<strong-accent/>' : '<accent/>')
    if (t.type === 'staccato') articulations.push('<staccato/>')
    if (t.type === 'tenuto') articulations.push('<tenuto/>')
  }
  if (articulations.length) notations.push(`<articulations>${articulations.join('')}</articulations>`)

  // Arpeggiate
  const arp = note.techniques.find((t) => t.type === 'arpeggio')
  if (arp && arp.type === 'arpeggio') notations.push(`<arpeggiate direction="${arp.direction}"/>`)

  if (notations.length) {
    xml += `        <notations>${notations.join('')}</notations>\n`
  }

  // Lyric
  if (note.lyric) {
    xml += `        <lyric><syllabic>single</syllabic><text>${xmlEscape(note.lyric)}</text></lyric>\n`
  }

  // Pick stroke (direction type, not notation)
  const pick = note.techniques.find((t) => t.type === 'pickStroke')
  if (pick && pick.type === 'pickStroke') {
    xml += `        <direction><direction-type>${pick.direction === 'up' ? '<up-bow/>' : '<down-bow/>'}</direction-type></direction>\n`
  }

  return xml
}
```

- [ ] **Step 2: Update per-measure attributes for mid-score key/time sig**

In the measure rendering loop, check `measure.timeSignature` and `measure.keySignature` and emit `<attributes>` when present.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/scoreDocument.ts
git commit -m "feat(editor): update MusicXML export for Technique[], tuplet, dots, lyrics, per-measure attributes"
```

---

## Task 17: MusicXML Import — New Techniques + Tuplet + Lyrics

**Files:**
- Modify: `client/src/lib/scoreDocument.ts` (the `parseMusicXmlToScoreDocument` function, lines 329-428)

- [ ] **Step 1: Update parseTechniqueSet → parseTechniques**

Replace the old `parseTechniqueSet` function (lines 175-188) with a new `parseTechniques` that returns `Technique[]`:

```ts
function parseTechniques(noteEl: Element): Technique[] {
  const techniques: Technique[] = []
  const notations = noteEl.querySelector('notations')
  if (!notations) return techniques

  // Technical
  const technical = notations.querySelector('technical')
  if (technical) {
    if (technical.querySelector('bend')) {
      const alter = parseFloat(technical.querySelector('bend > bend-alter')?.textContent ?? '2')
      if (alter < 0) {
        techniques.push({ type: 'tremoloBar', semitones: Math.abs(alter) })
      } else {
        techniques.push({ type: 'bend', style: 'full', semitones: alter })
      }
    }
    if (technical.querySelector('slide')) techniques.push({ type: 'slide', style: 'shift' })
    if (technical.querySelector('hammer-on')) techniques.push({ type: 'hammerOn' })
    if (technical.querySelector('pull-off')) techniques.push({ type: 'pullOff' })
    if (technical.querySelector('tap')) techniques.push({ type: 'tap' })
    if (technical.querySelector('harmonic')) {
      const style = technical.querySelector('harmonic > artificial') ? 'artificial' : 'natural'
      techniques.push({ type: 'harmonic', style })
    }
    if (technical.querySelector('let-ring')) techniques.push({ type: 'letRing' })
    if (technical.querySelector('palm-mute')) techniques.push({ type: 'palmMute' })
  }

  // Ornaments
  const ornaments = notations.querySelector('ornaments')
  if (ornaments) {
    const tremolo = ornaments.querySelector('tremolo')
    if (tremolo) {
      const val = parseInt(tremolo.textContent ?? '2', 10)
      const speed = val >= 3 ? 'thirtySecond' : val >= 2 ? 'sixteenth' : 'eighth'
      techniques.push({ type: 'tremoloPicking', speed })
    }
    if (ornaments.querySelector('wavy-line')) techniques.push({ type: 'vibrato', style: 'normal' })
  }

  // Articulations
  const articulations = notations.querySelector('articulations')
  if (articulations) {
    if (articulations.querySelector('strong-accent')) techniques.push({ type: 'accent', style: 'heavy' })
    else if (articulations.querySelector('accent')) techniques.push({ type: 'accent', style: 'normal' })
    if (articulations.querySelector('staccato')) techniques.push({ type: 'staccato' })
    if (articulations.querySelector('tenuto')) techniques.push({ type: 'tenuto' })
  }

  // Arpeggiate
  const arp = notations.querySelector('arpeggiate')
  if (arp) {
    techniques.push({ type: 'arpeggio', direction: (arp.getAttribute('direction') as 'up' | 'down') ?? 'up' })
  }

  // Notehead
  const notehead = noteEl.querySelector('notehead')
  if (notehead) {
    if (notehead.textContent === 'x') techniques.push({ type: 'deadNote' })
    else if (notehead.getAttribute('parentheses') === 'yes') techniques.push({ type: 'ghostNote' })
  }

  return techniques
}
```

- [ ] **Step 2: Parse tuplet, dots, lyrics in note loop**

In the note parsing loop inside `parseMusicXmlToScoreDocument`:

```ts
// Dots
const dots = noteEl.querySelectorAll('dot').length

// Tuplet
const timeMod = noteEl.querySelector('time-modification')
const tuplet = timeMod ? {
  actual: parseInt(timeMod.querySelector('actual-notes')?.textContent ?? '3', 10),
  normal: parseInt(timeMod.querySelector('normal-notes')?.textContent ?? '2', 10),
} : undefined

// Lyrics
const lyricEl = noteEl.querySelector('lyric > text')
const lyric = lyricEl?.textContent || undefined
```

- [ ] **Step 3: Parse per-measure key/time signature**

In the measure metadata parsing, check for `<attributes><time>` and `<attributes><key>` and set `measureMeta.timeSignature` / `measureMeta.keySignature`.

- [ ] **Step 4: Run existing scoreDocument tests**

Run: `pnpm -F @lava/client exec vitest run client/src/lib/scoreDocument.test.ts`

Expected: PASS (existing tests should still work, possibly with minor adjustments for Technique[] change).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/scoreDocument.ts
git commit -m "feat(editor): update MusicXML import for Technique[], tuplet, dots, lyrics, per-measure attributes"
```

---

## Task 18: TabCanvas — Update for Technique[]

**Files:**
- Modify: `client/src/spaces/pack/TabCanvas.tsx`

- [ ] **Step 1: Update technique checks**

In `TabCanvas.tsx`, find all places that reference `note.techniques.bend`, `note.techniques.slide`, etc. (the old TechniqueSet boolean access pattern). Replace with array lookups:

```ts
// Before:
note.techniques.bend

// After:
note.techniques.some((t) => t.type === 'bend')
```

Specifically check:
- The note inspector panel (around lines 824-848)
- The technique display in the overlay
- The `toggleTechnique` function if it exists locally

- [ ] **Step 2: Update applyCommand calls for addTechnique/removeTechnique**

Ensure any direct `applyCommand({ type: 'addTechnique', ... })` calls pass a full `Technique` object instead of a string key.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: No errors related to Technique/TechniqueSet.

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/TabCanvas.tsx
git commit -m "fix(editor): update TabCanvas for Technique[] API"
```

---

## Task 19: musicXmlEngine.ts Cleanup

**Files:**
- Modify: `client/src/lib/musicXmlEngine.ts`

- [ ] **Step 1: Search for all imports of musicXmlEngine**

Run: grep for `from.*musicXmlEngine` across the codebase. For each importing file, verify whether it uses any editing functions or only read-only utilities.

- [ ] **Step 2: Remove editing functions**

Remove these functions from `musicXmlEngine.ts`:
- `addBars`, `deleteBars`, `clearBars`
- `setChord`, `setKeySig`, `setTimeSig`
- `setNotePitch`, `setNoteDuration`
- `addAccidental`, `toggleTie`, `toggleRest`
- `transposeBars`, `pasteBars`, `duplicateBars`
- `setLyric`, `setAnnotation`

Also remove internal helpers only used by those functions (`renumberMeasures`, `buildWholeRestNote`, `createRestMeasure`).

Keep: `parseXml`, `serializeXml`, `getMeasures`, `getTimeInfo`, `getNotes`, `copyBars`, `buildScoreSummary`, `buildNoteOnsetMap`.

- [ ] **Step 3: Fix any broken imports**

If any file was importing an editing function from `musicXmlEngine`, migrate it to use `useScoreDocumentStore.applyCommand()` instead.

- [ ] **Step 4: Run full typecheck and tests**

Run: `pnpm typecheck && pnpm -F @lava/client exec vitest run`

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/musicXmlEngine.ts
git commit -m "refactor: remove editing functions from musicXmlEngine, keep read-only utils only"
```

---

## Task 20: Remove Deprecated TechniqueSet

**Files:**
- Modify: `packages/shared/src/types/score.ts`
- Modify: any remaining files referencing `TechniqueSet`

- [ ] **Step 1: Remove the deprecated TechniqueSet interface**

In `score.ts`, remove the `@deprecated` `TechniqueSet` interface added in Task 1.

- [ ] **Step 2: Search and fix any remaining references**

Run: grep for `TechniqueSet` across the codebase. Fix any remaining references.

- [ ] **Step 3: Final full build**

Run: `pnpm typecheck && pnpm build && pnpm -F @lava/client exec vitest run`

All should pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated TechniqueSet, migration complete"
```

---

## Task 21: Integration Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/editor` and test:
1. Insert notes with different durations — verify they render in AlphaTab
2. Insert notes until a bar is full — verify the next note auto-truncates
3. Click each technique button — verify the command applies to the selected note
4. Press keyboard shortcuts: `.` (dot), `Shift+T` (triplet), `#` (sharp), `Cmd+C/V` (copy/paste)
5. Change time signature mid-score — verify subsequent bars re-validate
6. Export and re-import — verify techniques survive MusicXML round-trip

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: integration fixes from smoke testing"
```
