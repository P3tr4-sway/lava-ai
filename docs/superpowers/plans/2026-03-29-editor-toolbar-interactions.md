# Editor Toolbar & Score Interactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every toolbar tool to the OSMD score with visual feedback, a MusicXML engine for real edits, and training-wheel features for non-pro musicians.

**Architecture:** Hybrid HTML overlay + SVG class injection. Pure-function `musicXmlEngine.ts` transforms MusicXML strings; OSMD is read-only renderer. All interactive UI (popovers, context pill, fretboard, cursor) are React components in an HTML overlay div. After each OSMD re-render, `useScoreSync` re-applies highlight classes and repositions overlay components.

**Tech Stack:** React 18, Zustand, TypeScript, OSMD (SVG), Tailwind CSS, Vite, browser-native DOMParser/XMLSerializer for MusicXML.

**Spec:** `docs/superpowers/specs/2026-03-29-editor-toolbar-interactions-design.md`

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `client/src/lib/musicXmlEngine.ts` | Pure functions: parse, transform, serialize MusicXML |
| `client/src/lib/musicXmlEngine.test.ts` | Unit tests for all engine functions |
| `client/src/lib/chordVoicings.ts` | Guitar chord voicing data (finger positions per chord) |
| `client/src/lib/pitchUtils.ts` | Pitch ↔ MIDI ↔ fret mapping, diatonic step math |
| `client/src/lib/pitchUtils.test.ts` | Unit tests for pitch utilities |
| `client/src/components/score/ScoreOverlay.tsx` | Positioned overlay container, routes events to children |
| `client/src/components/score/SelectionRect.tsx` | Drag-to-select rectangle (range tool) |
| `client/src/components/score/PlaybackCursor.tsx` | Animated vertical line + auto-scroll |
| `client/src/components/score/ContextPill.tsx` | Smart floating toolbar with context-aware actions |
| `client/src/components/score/MiniFretboard.tsx` | 6×12 SVG fretboard for pitch input |
| `client/src/components/score/DurationPalette.tsx` | Duration picker popover |
| `client/src/components/score/LyricInput.tsx` | Inline lyric text input attached to notes |
| `client/src/components/score/AnnotationInput.tsx` | Inline free-text annotation input |
| `client/src/components/score/ChordDiagram.tsx` | SVG guitar chord box diagram |
| `client/src/components/score/ChordDiagramPopover.tsx` | Hover/tap wrapper for chord diagrams |
| `client/src/hooks/useScoreSync.ts` | Post-render: re-apply highlights, reposition overlays |
| `client/src/hooks/useRangeSelect.ts` | Mouse down/move/up logic for range drag |
| `client/src/hooks/useNoteDrag.ts` | Pitch drag + duration resize on note elements |
| `client/src/hooks/usePlaybackCursor.ts` | rAF animation loop, onset map, auto-scroll |

### Modified files

| File | Changes |
|---|---|
| `client/src/stores/editorStore.ts` | Add `selectedNotes`, `clipboard`, `showChordDiagrams`, `showBeatMarkers`, note selection methods, training-wheel toggles |
| `client/src/spaces/pack/EditorCanvas.tsx` | Replace `findClickedMeasure` with `findClickedElement`, wrap score in `ScoreOverlay`, integrate `useScoreSync` |
| `client/src/spaces/pack/EditorToolbar.tsx` | Add training-wheel toggles, wire all tool actions through `musicXmlEngine` |
| `client/src/spaces/pack/EditorPage.tsx` | Implement `handleAddBar`/`handleDeleteBars` stubs via engine |
| `client/src/hooks/useEditorKeyboard.ts` | Add R/K/F/D/#/B/N/L shortcuts, note-level operations, copy/paste/duplicate, transpose |
| `client/src/styles/tokens.css` | Append `.lava-bar-selected`, `.lava-note-selected`, `.lava-bar-playing`, `.lava-note-playing`, `.lava-beat-marker` classes |

---

## Task 1: CSS Highlight Classes

**Files:**
- Modify: `client/src/styles/tokens.css` (append after line 72)

- [ ] **Step 1: Add all score highlight CSS classes**

Append to the end of `client/src/styles/tokens.css`:

```css
/* === Score interaction highlights === */

.lava-bar-selected > rect:first-child,
.lava-bar-selected > path:first-child {
  fill: var(--accent);
  opacity: 0.1;
}

.lava-note-selected .vf-notehead path {
  stroke: var(--accent);
  stroke-width: 2;
}

.lava-bar-playing > rect:first-child,
.lava-bar-playing > path:first-child {
  fill: var(--accent);
  opacity: 0.05;
}

.lava-note-playing .vf-notehead path {
  fill: var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
  transition: fill 100ms ease-out, filter 100ms ease-out;
}

.lava-beat-marker {
  stroke: var(--border);
  opacity: 0.3;
  stroke-dasharray: 2;
}

.lava-beat-marker-downbeat {
  opacity: 0.5;
}
```

- [ ] **Step 2: Verify dev server renders without errors**

Run: `pnpm dev` — confirm no CSS parse errors in terminal or browser console.

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/tokens.css
git commit -m "feat(editor): add CSS highlight classes for score selection and playback"
```

---

## Task 2: Extend editorStore with Note Selection, Clipboard, and Training-Wheel Toggles

**Files:**
- Modify: `client/src/stores/editorStore.ts`

- [ ] **Step 1: Add types and new state fields to the EditorStore interface**

In `client/src/stores/editorStore.ts`, add the `NoteRef` type after line 5 and extend the interface:

```typescript
// After line 5 (after SaveStatus type)
export interface NoteRef {
  barIndex: number
  noteIndex: number
}
```

Add these fields to the `EditorStore` interface (after the existing `clearSelection` on line 18):

```typescript
  // Note-level selection (mutually exclusive with bar selection)
  selectedNotes: NoteRef[]
  selectNote: (barIndex: number, noteIndex: number, additive?: boolean) => void
  clearNoteSelection: () => void

  // Clipboard
  clipboard: string | null
  setClipboard: (fragment: string | null) => void

  // Training wheels
  showChordDiagrams: boolean
  showBeatMarkers: boolean
  toggleChordDiagrams: () => void
  toggleBeatMarkers: () => void
```

- [ ] **Step 2: Implement the new state and actions in the store**

In the `create` body (after `clearSelection` implementation around line 67), add:

```typescript
    // Note selection
    selectedNotes: [],
    selectNote: (barIndex, noteIndex, additive) => {
      set((s) => {
        const ref: NoteRef = { barIndex, noteIndex }
        const exists = s.selectedNotes.findIndex(
          (n) => n.barIndex === barIndex && n.noteIndex === noteIndex
        )
        let next: NoteRef[]
        if (additive) {
          next = exists >= 0
            ? s.selectedNotes.filter((_, i) => i !== exists)
            : [...s.selectedNotes, ref]
        } else {
          next = [ref]
        }
        return { selectedNotes: next, selectedBars: [] } // mutual exclusion
      })
    },
    clearNoteSelection: () => set({ selectedNotes: [] }),

    // Clipboard
    clipboard: null,
    setClipboard: (fragment) => set({ clipboard: fragment }),

    // Training wheels
    showChordDiagrams: false,
    showBeatMarkers: false,
    toggleChordDiagrams: () => set((s) => ({ showChordDiagrams: !s.showChordDiagrams })),
    toggleBeatMarkers: () => set((s) => ({ showBeatMarkers: !s.showBeatMarkers })),
```

- [ ] **Step 3: Update `selectBar` to clear note selection (mutual exclusion)**

Modify the existing `selectBar` implementation (around line 53) to also clear `selectedNotes`:

In the `selectBar` method, add `selectedNotes: []` to each return branch:

```typescript
    selectBar: (bar, additive) => {
      set((s) => {
        if (additive) {
          const has = s.selectedBars.includes(bar)
          return {
            selectedBars: has
              ? s.selectedBars.filter((b) => b !== bar)
              : [...s.selectedBars, bar],
            selectedNotes: [], // mutual exclusion
          }
        }
        return { selectedBars: [bar], selectedNotes: [] } // mutual exclusion
      })
    },
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/editorStore.ts
git commit -m "feat(editor): add note selection, clipboard, and training-wheel toggles to editorStore"
```

---

## Task 3: Pitch Utilities

**Files:**
- Create: `client/src/lib/pitchUtils.ts`
- Create: `client/src/lib/pitchUtils.test.ts`

- [ ] **Step 1: Write failing tests for pitch utilities**

Create `client/src/lib/pitchUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  pitchToMidi,
  midiToPitch,
  stepDiatonic,
  midiToFret,
  fretToMidi,
  STANDARD_TUNING,
} from './pitchUtils'

describe('pitchToMidi', () => {
  it('converts C4 to 60', () => {
    expect(pitchToMidi({ step: 'C', octave: 4 })).toBe(60)
  })
  it('converts A4 to 69', () => {
    expect(pitchToMidi({ step: 'A', octave: 4 })).toBe(69)
  })
  it('handles sharps', () => {
    expect(pitchToMidi({ step: 'F', octave: 4, alter: 1 })).toBe(66)
  })
  it('handles flats', () => {
    expect(pitchToMidi({ step: 'B', octave: 3, alter: -1 })).toBe(58)
  })
})

describe('midiToPitch', () => {
  it('converts 60 to C4', () => {
    expect(midiToPitch(60)).toEqual({ step: 'C', octave: 4, alter: 0 })
  })
  it('converts 61 to C#4', () => {
    expect(midiToPitch(61)).toEqual({ step: 'C', octave: 4, alter: 1 })
  })
})

describe('stepDiatonic', () => {
  it('steps up from C4', () => {
    expect(stepDiatonic({ step: 'C', octave: 4 }, 1)).toEqual({ step: 'D', octave: 4, alter: 0 })
  })
  it('wraps from B to next octave', () => {
    expect(stepDiatonic({ step: 'B', octave: 4 }, 1)).toEqual({ step: 'C', octave: 5, alter: 0 })
  })
  it('steps down from C to previous octave', () => {
    expect(stepDiatonic({ step: 'C', octave: 4 }, -1)).toEqual({ step: 'B', octave: 3, alter: 0 })
  })
  it('jumps octave up', () => {
    expect(stepDiatonic({ step: 'E', octave: 3 }, 7)).toEqual({ step: 'E', octave: 4, alter: 0 })
  })
})

describe('midiToFret', () => {
  it('finds E2 on open 6th string', () => {
    const result = midiToFret(40, STANDARD_TUNING)
    expect(result).toContainEqual({ string: 6, fret: 0 })
  })
  it('finds A4 on multiple strings', () => {
    const result = midiToFret(69, STANDARD_TUNING)
    expect(result.length).toBeGreaterThan(0)
    result.forEach((r) => {
      expect(r.fret).toBeGreaterThanOrEqual(0)
      expect(r.fret).toBeLessThanOrEqual(12)
    })
  })
})

describe('fretToMidi', () => {
  it('converts 6th string open to E2 (40)', () => {
    expect(fretToMidi(6, 0, STANDARD_TUNING)).toBe(40)
  })
  it('converts 1st string 5th fret to A4 (69)', () => {
    expect(fretToMidi(1, 5, STANDARD_TUNING)).toBe(69)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd client && npx vitest run src/lib/pitchUtils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pitchUtils**

Create `client/src/lib/pitchUtils.ts`:

```typescript
export interface Pitch {
  step: string // 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
  octave: number
  alter?: number // -1 flat, 0 natural, 1 sharp
}

export interface FretPosition {
  string: number // 1-6, 1 = highest (high E)
  fret: number   // 0-12
}

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

const DIATONIC_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// Standard guitar tuning: string 1 (high E) to string 6 (low E), as MIDI numbers
export const STANDARD_TUNING = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2

export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + STEP_TO_SEMITONE[p.step] + (p.alter ?? 0)
}

export function midiToPitch(midi: number): Pitch {
  const octave = Math.floor(midi / 12) - 1
  const semitone = midi % 12
  // Find closest natural note
  for (const [step, semi] of Object.entries(STEP_TO_SEMITONE)) {
    if (semi === semitone) return { step, octave, alter: 0 }
  }
  // It's a sharp — find the note below
  for (const [step, semi] of Object.entries(STEP_TO_SEMITONE)) {
    if (semi === semitone - 1) return { step, octave, alter: 1 }
  }
  return { step: 'C', octave, alter: 0 } // fallback
}

export function stepDiatonic(p: Pitch, steps: number): Pitch {
  const idx = DIATONIC_STEPS.indexOf(p.step)
  const newIdx = idx + steps
  const octaveShift = Math.floor(newIdx / 7)
  const wrappedIdx = ((newIdx % 7) + 7) % 7
  return {
    step: DIATONIC_STEPS[wrappedIdx],
    octave: p.octave + octaveShift,
    alter: 0,
  }
}

export function midiToFret(midi: number, tuning: number[]): FretPosition[] {
  const positions: FretPosition[] = []
  for (let s = 0; s < tuning.length; s++) {
    const fret = midi - tuning[s]
    if (fret >= 0 && fret <= 12) {
      positions.push({ string: s + 1, fret })
    }
  }
  return positions
}

export function fretToMidi(string: number, fret: number, tuning: number[]): number {
  return tuning[string - 1] + fret
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd client && npx vitest run src/lib/pitchUtils.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/pitchUtils.ts client/src/lib/pitchUtils.test.ts
git commit -m "feat(editor): add pitch utility functions with tests"
```

---

## Task 4: MusicXML Engine — Core Parsing and Bar Operations

**Files:**
- Create: `client/src/lib/musicXmlEngine.ts`
- Create: `client/src/lib/musicXmlEngine.test.ts`

- [ ] **Step 1: Write failing tests for parse, serialize, addBars, deleteBars, clearBars**

Create `client/src/lib/musicXmlEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  parseXml,
  serializeXml,
  getMeasures,
  addBars,
  deleteBars,
  clearBars,
} from './musicXmlEngine'

const SIMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><rest/><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

describe('parseXml / serializeXml', () => {
  it('round-trips without data loss', () => {
    const doc = parseXml(SIMPLE_XML)
    const result = serializeXml(doc)
    const doc2 = parseXml(result)
    expect(getMeasures(doc2).length).toBe(3)
  })
})

describe('getMeasures', () => {
  it('returns all measures', () => {
    const doc = parseXml(SIMPLE_XML)
    expect(getMeasures(doc).length).toBe(3)
  })
})

describe('addBars', () => {
  it('adds 2 empty bars after bar 1', () => {
    const result = addBars(SIMPLE_XML, 0, 2)
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(5)
  })

  it('new bars contain whole rests', () => {
    const result = addBars(SIMPLE_XML, 0, 1)
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    const newMeasure = measures[1] // inserted after index 0
    const rest = newMeasure.querySelector('rest')
    expect(rest).not.toBeNull()
  })

  it('renumbers measures sequentially', () => {
    const result = addBars(SIMPLE_XML, 0, 1)
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    measures.forEach((m, i) => {
      expect(m.getAttribute('number')).toBe(String(i + 1))
    })
  })
})

describe('deleteBars', () => {
  it('deletes bar at index 1', () => {
    const result = deleteBars(SIMPLE_XML, [1])
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(2)
  })

  it('renumbers remaining measures', () => {
    const result = deleteBars(SIMPLE_XML, [1])
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    measures.forEach((m, i) => {
      expect(m.getAttribute('number')).toBe(String(i + 1))
    })
  })

  it('deletes multiple non-contiguous bars', () => {
    const result = deleteBars(SIMPLE_XML, [0, 2])
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(1)
  })
})

describe('clearBars', () => {
  it('replaces content with whole rest but keeps the bar', () => {
    const result = clearBars(SIMPLE_XML, [0])
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    expect(measures.length).toBe(3) // same count
    const notes = measures[0].querySelectorAll('note')
    expect(notes.length).toBe(1)
    expect(notes[0].querySelector('rest')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement core engine functions**

Create `client/src/lib/musicXmlEngine.ts`:

```typescript
const parser = new DOMParser()
const serializer = new XMLSerializer()

export function parseXml(xml: string): Document {
  const doc = parser.parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error(`MusicXML parse error: ${err.textContent}`)
  return doc
}

export function serializeXml(doc: Document): string {
  return serializer.serializeToString(doc)
}

export function getMeasures(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('part > measure'))
}

function renumberMeasures(doc: Document): void {
  getMeasures(doc).forEach((m, i) => m.setAttribute('number', String(i + 1)))
}

function createRestMeasure(doc: Document, divisions: number, beats: number): Element {
  const m = doc.createElement('measure')
  m.setAttribute('number', '0') // will be renumbered
  const note = doc.createElement('note')
  const rest = doc.createElement('rest')
  const dur = doc.createElement('duration')
  dur.textContent = String(divisions * beats)
  const type = doc.createElement('type')
  type.textContent = 'whole'
  note.appendChild(rest)
  note.appendChild(dur)
  note.appendChild(type)
  m.appendChild(note)
  return m
}

function getTimeInfo(doc: Document): { divisions: number; beats: number } {
  const divEl = doc.querySelector('attributes > divisions')
  const beatsEl = doc.querySelector('time > beats')
  return {
    divisions: divEl ? parseInt(divEl.textContent || '1', 10) : 1,
    beats: beatsEl ? parseInt(beatsEl.textContent || '4', 10) : 4,
  }
}

export function addBars(xml: string, afterIndex: number, count: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const { divisions, beats } = getTimeInfo(doc)
  const ref = measures[afterIndex]
  const parent = ref.parentNode!

  for (let i = 0; i < count; i++) {
    const newMeasure = createRestMeasure(doc, divisions, beats)
    parent.insertBefore(newMeasure, ref.nextSibling)
  }

  renumberMeasures(doc)
  return serializeXml(doc)
}

export function deleteBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  // Sort descending so removal doesn't shift indices
  const sorted = [...barIndices].sort((a, b) => b - a)
  for (const idx of sorted) {
    if (idx >= 0 && idx < measures.length) {
      measures[idx].parentNode!.removeChild(measures[idx])
    }
  }
  renumberMeasures(doc)
  return serializeXml(doc)
}

export function clearBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const { divisions, beats } = getTimeInfo(doc)

  for (const idx of barIndices) {
    const m = measures[idx]
    if (!m) continue
    // Remove all note, forward, backup, harmony, direction elements
    const toRemove = m.querySelectorAll('note, forward, backup, harmony, direction')
    toRemove.forEach((el) => el.parentNode!.removeChild(el))
    // Add whole rest
    const note = doc.createElement('note')
    const rest = doc.createElement('rest')
    const dur = doc.createElement('duration')
    dur.textContent = String(divisions * beats)
    const type = doc.createElement('type')
    type.textContent = 'whole'
    note.appendChild(rest)
    note.appendChild(dur)
    note.appendChild(type)
    m.appendChild(note)
  }

  return serializeXml(doc)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/musicXmlEngine.ts client/src/lib/musicXmlEngine.test.ts
git commit -m "feat(editor): MusicXML engine with parse, addBars, deleteBars, clearBars"
```

---

## Task 5: MusicXML Engine — Chord, Key Signature, Time Signature

**Files:**
- Modify: `client/src/lib/musicXmlEngine.ts`
- Modify: `client/src/lib/musicXmlEngine.test.ts`

- [ ] **Step 1: Write failing tests for setChord, setKeySig, setTimeSig**

Append to `client/src/lib/musicXmlEngine.test.ts`:

```typescript
import {
  // ... existing imports ...
  setChord,
  setKeySig,
  setTimeSig,
} from './musicXmlEngine'

describe('setChord', () => {
  it('adds a harmony element to bar 0 beat 0', () => {
    const result = setChord(SIMPLE_XML, 0, 0, 'Am7')
    const doc = parseXml(result)
    const harmony = getMeasures(doc)[0].querySelector('harmony')
    expect(harmony).not.toBeNull()
    const root = harmony!.querySelector('root > root-step')
    expect(root!.textContent).toBe('A')
    const kind = harmony!.querySelector('kind')
    expect(kind!.textContent).toBe('minor-seventh')
  })

  it('replaces existing chord at same position', () => {
    const withChord = setChord(SIMPLE_XML, 0, 0, 'Am7')
    const result = setChord(withChord, 0, 0, 'G')
    const doc = parseXml(result)
    const harmonies = getMeasures(doc)[0].querySelectorAll('harmony')
    expect(harmonies.length).toBe(1)
    expect(harmonies[0].querySelector('root > root-step')!.textContent).toBe('G')
  })
})

describe('setKeySig', () => {
  it('changes key signature from bar onward', () => {
    const result = setKeySig(SIMPLE_XML, 0, 'G')
    const doc = parseXml(result)
    const fifths = getMeasures(doc)[0].querySelector('key > fifths')
    expect(fifths!.textContent).toBe('1') // G major = 1 sharp
  })
})

describe('setTimeSig', () => {
  it('changes time signature at specified bar', () => {
    const result = setTimeSig(SIMPLE_XML, 1, 3, 4)
    const doc = parseXml(result)
    const m = getMeasures(doc)[1]
    const beats = m.querySelector('time > beats')
    expect(beats!.textContent).toBe('3')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: FAIL — setChord, setKeySig, setTimeSig not exported.

- [ ] **Step 3: Implement setChord, setKeySig, setTimeSig**

Append to `client/src/lib/musicXmlEngine.ts`:

```typescript
// --- Chord name → MusicXML harmony mapping ---

const CHORD_KINDS: Record<string, { root: string; alter?: number; kind: string }> = {}

function parseChordName(name: string): { rootStep: string; rootAlter: number; kind: string } {
  // Extract root note (e.g., 'C', 'F#', 'Bb')
  let rootStep = name[0].toUpperCase()
  let rootAlter = 0
  let rest = name.slice(1)

  if (rest.startsWith('#') || rest.startsWith('♯')) {
    rootAlter = 1
    rest = rest.slice(1)
  } else if (rest.startsWith('b') && rest !== 'b' || rest.startsWith('♭')) {
    rootAlter = -1
    rest = rest.slice(1)
  }

  // Map suffix to MusicXML kind
  const kindMap: Record<string, string> = {
    '': 'major',
    'm': 'minor',
    'min': 'minor',
    'minor': 'minor',
    '7': 'dominant',
    'maj7': 'major-seventh',
    'M7': 'major-seventh',
    'm7': 'minor-seventh',
    'min7': 'minor-seventh',
    'dim': 'diminished',
    'dim7': 'diminished-seventh',
    'aug': 'augmented',
    'sus2': 'suspended-second',
    'sus4': 'suspended-fourth',
    '6': 'major-sixth',
    'm6': 'minor-sixth',
    '9': 'dominant-ninth',
    'maj9': 'major-ninth',
    'm9': 'minor-ninth',
    'add9': 'major',
    '5': 'power',
  }

  const kind = kindMap[rest] ?? 'major'
  return { rootStep, rootAlter, kind }
}

export function setChord(xml: string, barIndex: number, beatIndex: number, chordSymbol: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml

  const { rootStep, rootAlter, kind } = parseChordName(chordSymbol)

  // Remove existing harmony at same offset (simplified: remove all for now if beat 0)
  const existing = m.querySelectorAll('harmony')
  existing.forEach((h) => {
    const offset = h.querySelector('offset')
    const hBeat = offset ? Math.floor(parseInt(offset.textContent || '0', 10)) : 0
    if (hBeat === beatIndex) h.parentNode!.removeChild(h)
  })

  // Build <harmony> element
  const harmony = doc.createElement('harmony')
  const root = doc.createElement('root')
  const rootStepEl = doc.createElement('root-step')
  rootStepEl.textContent = rootStep
  root.appendChild(rootStepEl)
  if (rootAlter !== 0) {
    const rootAlterEl = doc.createElement('root-alter')
    rootAlterEl.textContent = String(rootAlter)
    root.appendChild(rootAlterEl)
  }
  harmony.appendChild(root)
  const kindEl = doc.createElement('kind')
  kindEl.textContent = kind
  harmony.appendChild(kindEl)

  if (beatIndex > 0) {
    const { divisions } = getTimeInfo(doc)
    const offset = doc.createElement('offset')
    offset.textContent = String(beatIndex * divisions)
    harmony.appendChild(offset)
  }

  // Insert harmony before first note
  const firstNote = m.querySelector('note')
  if (firstNote) {
    m.insertBefore(harmony, firstNote)
  } else {
    m.appendChild(harmony)
  }

  return serializeXml(doc)
}

const KEY_FIFTHS: Record<string, number> = {
  'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'Gb': -6,
  'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Cb': -7,
  'Am': 0, 'Em': 1, 'Bm': 2, 'F#m': 3, 'C#m': 4, 'G#m': 5,
  'Dm': -1, 'Gm': -2, 'Cm': -3, 'Fm': -4, 'Bbm': -5, 'Ebm': -6,
}

export function setKeySig(xml: string, fromBar: number, key: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[fromBar]
  if (!m) return xml

  const fifths = KEY_FIFTHS[key] ?? 0

  // Find or create <attributes> block
  let attrs = m.querySelector('attributes')
  if (!attrs) {
    attrs = doc.createElement('attributes')
    m.insertBefore(attrs, m.firstChild)
  }

  // Find or create <key>
  let keyEl = attrs.querySelector('key')
  if (!keyEl) {
    keyEl = doc.createElement('key')
    attrs.appendChild(keyEl)
  }

  let fifthsEl = keyEl.querySelector('fifths')
  if (!fifthsEl) {
    fifthsEl = doc.createElement('fifths')
    keyEl.appendChild(fifthsEl)
  }
  fifthsEl.textContent = String(fifths)

  return serializeXml(doc)
}

export function setTimeSig(xml: string, fromBar: number, beats: number, beatType: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[fromBar]
  if (!m) return xml

  let attrs = m.querySelector('attributes')
  if (!attrs) {
    attrs = doc.createElement('attributes')
    m.insertBefore(attrs, m.firstChild)
  }

  let timeEl = attrs.querySelector('time')
  if (!timeEl) {
    timeEl = doc.createElement('time')
    attrs.appendChild(timeEl)
  }

  let beatsEl = timeEl.querySelector('beats')
  if (!beatsEl) {
    beatsEl = doc.createElement('beats')
    timeEl.appendChild(beatsEl)
  }
  beatsEl.textContent = String(beats)

  let beatTypeEl = timeEl.querySelector('beat-type')
  if (!beatTypeEl) {
    beatTypeEl = doc.createElement('beat-type')
    timeEl.appendChild(beatTypeEl)
  }
  beatTypeEl.textContent = String(beatType)

  return serializeXml(doc)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/musicXmlEngine.ts client/src/lib/musicXmlEngine.test.ts
git commit -m "feat(editor): MusicXML engine — setChord, setKeySig, setTimeSig"
```

---

## Task 6: MusicXML Engine — Note Operations (Pitch, Duration, Accidentals, Ties, Rests)

**Files:**
- Modify: `client/src/lib/musicXmlEngine.ts`
- Modify: `client/src/lib/musicXmlEngine.test.ts`

- [ ] **Step 1: Write failing tests for note operations**

Append to `client/src/lib/musicXmlEngine.test.ts`:

```typescript
import {
  // ... existing imports ...
  setNotePitch,
  setNoteDuration,
  addAccidental,
  toggleTie,
  toggleRest,
} from './musicXmlEngine'

describe('setNotePitch', () => {
  it('changes pitch of first note in bar 0', () => {
    const result = setNotePitch(SIMPLE_XML, 0, 0, { step: 'A', octave: 4, alter: 0 })
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('pitch > step')!.textContent).toBe('A')
    expect(note.querySelector('pitch > octave')!.textContent).toBe('4')
  })
})

describe('setNoteDuration', () => {
  it('changes duration type of a note', () => {
    const result = setNoteDuration(SIMPLE_XML, 0, 0, 'half', 2)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('type')!.textContent).toBe('half')
    expect(note.querySelector('duration')!.textContent).toBe('2')
  })
})

describe('addAccidental', () => {
  it('adds sharp accidental to a note', () => {
    const result = addAccidental(SIMPLE_XML, 0, 0, 'sharp')
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('accidental')!.textContent).toBe('sharp')
    expect(note.querySelector('pitch > alter')!.textContent).toBe('1')
  })
})

describe('toggleTie', () => {
  it('adds tie to a note that has none', () => {
    const result = toggleTie(SIMPLE_XML, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('tie')).not.toBeNull()
  })

  it('removes tie from a note that has one', () => {
    const withTie = toggleTie(SIMPLE_XML, 0, 0)
    const result = toggleTie(withTie, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('tie')).toBeNull()
  })
})

describe('toggleRest', () => {
  it('converts a note to rest of same duration', () => {
    const result = toggleRest(SIMPLE_XML, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('rest')).not.toBeNull()
    expect(note.querySelector('pitch')).toBeNull()
    expect(note.querySelector('type')!.textContent).toBe('quarter')
  })

  it('converts a rest back to a note (default C4)', () => {
    const withRest = toggleRest(SIMPLE_XML, 0, 0)
    const result = toggleRest(withRest, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('pitch')).not.toBeNull()
    expect(note.querySelector('rest')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement note operations**

Append to `client/src/lib/musicXmlEngine.ts`:

```typescript
import type { Pitch } from './pitchUtils'

function getNotes(measure: Element): Element[] {
  return Array.from(measure.querySelectorAll('note'))
}

export function setNotePitch(xml: string, barIndex: number, noteIndex: number, pitch: Pitch): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const notes = getNotes(measures[barIndex])
  const note = notes[noteIndex]
  if (!note) return xml

  // Remove existing rest if present
  const restEl = note.querySelector('rest')
  if (restEl) restEl.parentNode!.removeChild(restEl)

  // Find or create pitch element
  let pitchEl = note.querySelector('pitch')
  if (!pitchEl) {
    pitchEl = doc.createElement('pitch')
    note.insertBefore(pitchEl, note.firstChild)
  }

  let stepEl = pitchEl.querySelector('step')
  if (!stepEl) { stepEl = doc.createElement('step'); pitchEl.appendChild(stepEl) }
  stepEl.textContent = pitch.step

  let octEl = pitchEl.querySelector('octave')
  if (!octEl) { octEl = doc.createElement('octave'); pitchEl.appendChild(octEl) }
  octEl.textContent = String(pitch.octave)

  const existingAlter = pitchEl.querySelector('alter')
  if (pitch.alter && pitch.alter !== 0) {
    if (!existingAlter) {
      const alterEl = doc.createElement('alter')
      alterEl.textContent = String(pitch.alter)
      pitchEl.insertBefore(alterEl, octEl)
    } else {
      existingAlter.textContent = String(pitch.alter)
    }
  } else if (existingAlter) {
    existingAlter.parentNode!.removeChild(existingAlter)
  }

  return serializeXml(doc)
}

export function setNoteDuration(
  xml: string, barIndex: number, noteIndex: number,
  type: string, durationValue: number
): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const notes = getNotes(measures[barIndex])
  const note = notes[noteIndex]
  if (!note) return xml

  let typeEl = note.querySelector('type')
  if (!typeEl) { typeEl = doc.createElement('type'); note.appendChild(typeEl) }
  typeEl.textContent = type

  let durEl = note.querySelector('duration')
  if (!durEl) { durEl = doc.createElement('duration'); note.appendChild(durEl) }
  durEl.textContent = String(durationValue)

  return serializeXml(doc)
}

export function addAccidental(
  xml: string, barIndex: number, noteIndex: number,
  accidental: 'sharp' | 'flat' | 'natural'
): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const notes = getNotes(measures[barIndex])
  const note = notes[noteIndex]
  if (!note) return xml

  // Add/update accidental element
  let accEl = note.querySelector('accidental')
  if (!accEl) { accEl = doc.createElement('accidental'); note.appendChild(accEl) }
  accEl.textContent = accidental

  // Update pitch alter
  const pitchEl = note.querySelector('pitch')
  if (pitchEl) {
    const alterValue = accidental === 'sharp' ? 1 : accidental === 'flat' ? -1 : 0
    let alterEl = pitchEl.querySelector('alter')
    if (alterValue !== 0) {
      if (!alterEl) {
        alterEl = doc.createElement('alter')
        const octEl = pitchEl.querySelector('octave')
        pitchEl.insertBefore(alterEl, octEl)
      }
      alterEl.textContent = String(alterValue)
    } else if (alterEl) {
      alterEl.parentNode!.removeChild(alterEl)
    }
  }

  return serializeXml(doc)
}

export function toggleTie(xml: string, barIndex: number, noteIndex: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const notes = getNotes(measures[barIndex])
  const note = notes[noteIndex]
  if (!note) return xml

  const existingTie = note.querySelector('tie')
  if (existingTie) {
    // Remove all ties and notations/tied
    note.querySelectorAll('tie').forEach((t) => t.parentNode!.removeChild(t))
    const tied = note.querySelector('notations > tied')
    if (tied) tied.parentNode!.removeChild(tied)
  } else {
    const tie = doc.createElement('tie')
    tie.setAttribute('type', 'start')
    note.appendChild(tie)

    let notations = note.querySelector('notations')
    if (!notations) { notations = doc.createElement('notations'); note.appendChild(notations) }
    const tied = doc.createElement('tied')
    tied.setAttribute('type', 'start')
    notations.appendChild(tied)
  }

  return serializeXml(doc)
}

export function toggleRest(xml: string, barIndex: number, noteIndex: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const notes = getNotes(measures[barIndex])
  const note = notes[noteIndex]
  if (!note) return xml

  const isRest = !!note.querySelector('rest')

  if (isRest) {
    // Convert rest to note (default C4)
    const restEl = note.querySelector('rest')
    if (restEl) restEl.parentNode!.removeChild(restEl)
    const pitchEl = doc.createElement('pitch')
    const stepEl = doc.createElement('step')
    stepEl.textContent = 'C'
    const octEl = doc.createElement('octave')
    octEl.textContent = '4'
    pitchEl.appendChild(stepEl)
    pitchEl.appendChild(octEl)
    note.insertBefore(pitchEl, note.firstChild)
  } else {
    // Convert note to rest
    const pitchEl = note.querySelector('pitch')
    if (pitchEl) pitchEl.parentNode!.removeChild(pitchEl)
    // Remove accidentals, ties
    note.querySelectorAll('accidental, tie, notations').forEach((el) => el.parentNode!.removeChild(el))
    const restEl = doc.createElement('rest')
    note.insertBefore(restEl, note.firstChild)
  }

  return serializeXml(doc)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/musicXmlEngine.ts client/src/lib/musicXmlEngine.test.ts
git commit -m "feat(editor): MusicXML engine — note pitch, duration, accidental, tie, rest operations"
```

---

## Task 7: MusicXML Engine — Transpose, Copy/Paste, Duplicate, Lyrics, Annotations, Note Onset Map

**Files:**
- Modify: `client/src/lib/musicXmlEngine.ts`
- Modify: `client/src/lib/musicXmlEngine.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `client/src/lib/musicXmlEngine.test.ts`:

```typescript
import {
  // ... existing imports ...
  transposeBars,
  copyBars,
  pasteBars,
  duplicateBars,
  setLyric,
  setAnnotation,
  buildNoteOnsetMap,
} from './musicXmlEngine'

describe('transposeBars', () => {
  it('transposes all notes in bar up by 2 semitones', () => {
    const result = transposeBars(SIMPLE_XML, [0], 2)
    const doc = parseXml(result)
    const firstNote = getMeasures(doc)[0].querySelectorAll('note')[0]
    // C4 + 2 semitones = D4
    expect(firstNote.querySelector('pitch > step')!.textContent).toBe('D')
  })
})

describe('copyBars / pasteBars', () => {
  it('copies bar 0 and pastes after bar 2', () => {
    const fragment = copyBars(SIMPLE_XML, [0])
    const result = pasteBars(SIMPLE_XML, fragment, 2)
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(4)
  })
})

describe('duplicateBars', () => {
  it('duplicates bar 0 after itself', () => {
    const result = duplicateBars(SIMPLE_XML, [0], 0)
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(4)
    // Duplicated bar should have same notes
    const orig = getMeasures(parseXml(SIMPLE_XML))[0].querySelectorAll('note')
    const dup = getMeasures(doc)[1].querySelectorAll('note')
    expect(dup.length).toBe(orig.length)
  })
})

describe('setLyric', () => {
  it('adds lyric to a note', () => {
    const result = setLyric(SIMPLE_XML, 0, 0, 'hel-')
    const doc = parseXml(result)
    const lyric = getMeasures(doc)[0].querySelectorAll('note')[0].querySelector('lyric')
    expect(lyric).not.toBeNull()
    expect(lyric!.querySelector('text')!.textContent).toBe('hel-')
  })
})

describe('setAnnotation', () => {
  it('adds direction text above bar', () => {
    const result = setAnnotation(SIMPLE_XML, 0, 'palm mute')
    const doc = parseXml(result)
    const direction = getMeasures(doc)[0].querySelector('direction')
    expect(direction).not.toBeNull()
    const words = direction!.querySelector('direction-type > words')
    expect(words!.textContent).toBe('palm mute')
  })
})

describe('buildNoteOnsetMap', () => {
  it('builds onset map for simple XML', () => {
    const map = buildNoteOnsetMap(SIMPLE_XML, 120)
    expect(map.length).toBeGreaterThan(0)
    expect(map[0]).toMatchObject({ barIndex: 0, noteIndex: 0 })
    expect(typeof map[0].onsetTime).toBe('number')
    expect(typeof map[0].duration).toBe('number')
    // At 120 BPM, quarter note = 0.5s. First note onset should be 0
    expect(map[0].onsetTime).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement remaining engine functions**

Append to `client/src/lib/musicXmlEngine.ts`:

```typescript
import { pitchToMidi, midiToPitch } from './pitchUtils'

export function transposeBars(xml: string, barIndices: number[], semitones: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)

  for (const idx of barIndices) {
    const m = measures[idx]
    if (!m) continue
    const notes = getNotes(m)
    for (const note of notes) {
      const pitchEl = note.querySelector('pitch')
      if (!pitchEl) continue // skip rests
      const step = pitchEl.querySelector('step')!.textContent!
      const octave = parseInt(pitchEl.querySelector('octave')!.textContent!, 10)
      const alterEl = pitchEl.querySelector('alter')
      const alter = alterEl ? parseInt(alterEl.textContent!, 10) : 0

      const midi = pitchToMidi({ step, octave, alter })
      const newPitch = midiToPitch(midi + semitones)

      pitchEl.querySelector('step')!.textContent = newPitch.step
      pitchEl.querySelector('octave')!.textContent = String(newPitch.octave)

      if (newPitch.alter !== 0) {
        if (!alterEl) {
          const el = doc.createElement('alter')
          el.textContent = String(newPitch.alter)
          pitchEl.insertBefore(el, pitchEl.querySelector('octave'))
        } else {
          alterEl.textContent = String(newPitch.alter)
        }
      } else if (alterEl) {
        alterEl.parentNode!.removeChild(alterEl)
      }
    }
  }

  return serializeXml(doc)
}

export function copyBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const fragDoc = parser.parseFromString(
    '<measures></measures>', 'application/xml'
  )
  const root = fragDoc.documentElement

  for (const idx of [...barIndices].sort((a, b) => a - b)) {
    if (measures[idx]) {
      root.appendChild(fragDoc.importNode(measures[idx], true))
    }
  }

  return serializer.serializeToString(fragDoc)
}

export function pasteBars(xml: string, fragment: string, afterIndex: number): string {
  const doc = parseXml(xml)
  const fragDoc = parser.parseFromString(fragment, 'application/xml')
  const fragMeasures = Array.from(fragDoc.querySelectorAll('measure'))
  const measures = getMeasures(doc)
  const ref = measures[afterIndex]
  const parent = ref?.parentNode ?? doc.querySelector('part')!

  for (const fm of fragMeasures) {
    const imported = doc.importNode(fm, true)
    if (ref?.nextSibling) {
      parent.insertBefore(imported, ref.nextSibling)
    } else {
      parent.appendChild(imported)
    }
  }

  renumberMeasures(doc)
  return serializeXml(doc)
}

export function duplicateBars(xml: string, barIndices: number[], insertAfter: number): string {
  const fragment = copyBars(xml, barIndices)
  return pasteBars(xml, fragment, insertAfter)
}

export function setLyric(xml: string, barIndex: number, noteIndex: number, syllable: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const notes = getNotes(measures[barIndex])
  const note = notes[noteIndex]
  if (!note) return xml

  // Remove existing lyric
  const existing = note.querySelector('lyric')
  if (existing) existing.parentNode!.removeChild(existing)

  const lyric = doc.createElement('lyric')
  lyric.setAttribute('number', '1')
  const syllabicEl = doc.createElement('syllabic')
  // Detect syllabic type from text
  if (syllable.endsWith('-')) {
    syllabicEl.textContent = 'begin'
  } else if (syllable.startsWith('-')) {
    syllabicEl.textContent = 'end'
  } else {
    syllabicEl.textContent = 'single'
  }
  lyric.appendChild(syllabicEl)
  const textEl = doc.createElement('text')
  textEl.textContent = syllable
  lyric.appendChild(textEl)
  note.appendChild(lyric)

  return serializeXml(doc)
}

export function setAnnotation(xml: string, barIndex: number, text: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml

  const direction = doc.createElement('direction')
  direction.setAttribute('placement', 'above')
  const dirType = doc.createElement('direction-type')
  const words = doc.createElement('words')
  words.textContent = text
  dirType.appendChild(words)
  direction.appendChild(dirType)

  // Insert before first note
  const firstNote = m.querySelector('note')
  if (firstNote) {
    m.insertBefore(direction, firstNote)
  } else {
    m.appendChild(direction)
  }

  return serializeXml(doc)
}

export interface NoteOnset {
  barIndex: number
  noteIndex: number
  onsetTime: number  // seconds
  duration: number   // seconds
}

export function buildNoteOnsetMap(xml: string, bpm: number): NoteOnset[] {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const { divisions } = getTimeInfo(doc)
  const secondsPerDivision = 60 / (bpm * divisions)
  const onsets: NoteOnset[] = []
  let currentTime = 0

  for (let barIndex = 0; barIndex < measures.length; barIndex++) {
    const notes = getNotes(measures[barIndex])
    let noteIndex = 0
    for (const note of notes) {
      const durEl = note.querySelector('duration')
      const durDivisions = durEl ? parseInt(durEl.textContent || '1', 10) : 1
      const durSeconds = durDivisions * secondsPerDivision

      onsets.push({
        barIndex,
        noteIndex,
        onsetTime: currentTime,
        duration: durSeconds,
      })

      currentTime += durSeconds
      noteIndex++
    }
  }

  return onsets
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd client && npx vitest run src/lib/musicXmlEngine.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/musicXmlEngine.ts client/src/lib/musicXmlEngine.test.ts
git commit -m "feat(editor): MusicXML engine — transpose, copy/paste, duplicate, lyrics, annotations, onset map"
```

---

## Task 8: Score Overlay Container + `findClickedElement` + `useScoreSync`

**Files:**
- Create: `client/src/components/score/ScoreOverlay.tsx`
- Create: `client/src/hooks/useScoreSync.ts`
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Create ScoreOverlay component**

Create `client/src/components/score/ScoreOverlay.tsx`:

```typescript
import { cn } from '@/components/ui/utils'

interface ScoreOverlayProps {
  className?: string
  children?: React.ReactNode
}

export function ScoreOverlay({ className, children }: ScoreOverlayProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto',
        className
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create useScoreSync hook**

Create `client/src/hooks/useScoreSync.ts`:

```typescript
import { useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'

/**
 * Returns a sync function that re-applies CSS highlight classes to OSMD SVG elements.
 * Call after every OSMD re-render.
 */
export function useScoreSync(containerRef: React.RefObject<HTMLDivElement | null>) {
  const selectedBars = useEditorStore((s) => s.selectedBars)
  const selectedNotes = useEditorStore((s) => s.selectedNotes)
  const showBeatMarkers = useEditorStore((s) => s.showBeatMarkers)
  const currentBar = useAudioStore((s) => s.currentBar)
  const playbackState = useAudioStore((s) => s.playbackState)

  const syncHighlights = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Clear all highlights
    container.querySelectorAll('.lava-bar-selected').forEach((el) =>
      el.classList.remove('lava-bar-selected')
    )
    container.querySelectorAll('.lava-note-selected').forEach((el) =>
      el.classList.remove('lava-note-selected')
    )
    container.querySelectorAll('.lava-bar-playing').forEach((el) =>
      el.classList.remove('lava-bar-playing')
    )
    container.querySelectorAll('.lava-note-playing').forEach((el) =>
      el.classList.remove('lava-note-playing')
    )

    // Apply bar selection highlights
    const measureEls = container.querySelectorAll('[class*="vf-measure"]')
    measureEls.forEach((el) => {
      // OSMD measure IDs are 1-indexed
      const idMatch = el.id?.match(/(\d+)/)
      if (!idMatch) return
      const barIndex = parseInt(idMatch[1], 10) - 1

      if (selectedBars.includes(barIndex)) {
        el.classList.add('lava-bar-selected')
      }
      if (playbackState === 'playing' && barIndex === currentBar) {
        el.classList.add('lava-bar-playing')
      }
    })

    // Apply note selection highlights
    for (const { barIndex, noteIndex } of selectedNotes) {
      const measureEl = measureEls[barIndex]
      if (!measureEl) continue
      const noteEls = measureEl.querySelectorAll('[class*="vf-stavenote"]')
      const noteEl = noteEls[noteIndex]
      if (noteEl) noteEl.classList.add('lava-note-selected')
    }
  }, [selectedBars, selectedNotes, currentBar, playbackState, containerRef])

  /** Get bounding box of a measure element relative to container */
  const getMeasureBounds = useCallback((barIndex: number): DOMRect | null => {
    const container = containerRef.current
    if (!container) return null
    const measureEls = container.querySelectorAll('[class*="vf-measure"]')
    const el = measureEls[barIndex]
    if (!el) return null
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    return new DOMRect(
      elRect.x - containerRect.x,
      elRect.y - containerRect.y,
      elRect.width,
      elRect.height
    )
  }, [containerRef])

  /** Get bounding box of a note element relative to container */
  const getNoteBounds = useCallback((barIndex: number, noteIndex: number): DOMRect | null => {
    const container = containerRef.current
    if (!container) return null
    const measureEls = container.querySelectorAll('[class*="vf-measure"]')
    const measureEl = measureEls[barIndex]
    if (!measureEl) return null
    const noteEls = measureEl.querySelectorAll('[class*="vf-stavenote"]')
    const noteEl = noteEls[noteIndex]
    if (!noteEl) return null
    const containerRect = container.getBoundingClientRect()
    const elRect = noteEl.getBoundingClientRect()
    return new DOMRect(
      elRect.x - containerRect.x,
      elRect.y - containerRect.y,
      elRect.width,
      elRect.height
    )
  }, [containerRef])

  return { syncHighlights, getMeasureBounds, getNoteBounds }
}
```

- [ ] **Step 3: Add `findClickedElement` to EditorCanvas and integrate ScoreOverlay + useScoreSync**

In `client/src/spaces/pack/EditorCanvas.tsx`:

Replace the existing `findClickedMeasure` function (around line 184) with `findClickedElement`:

```typescript
function findClickedElement(
  container: HTMLElement,
  clientX: number,
  clientY: number
): { type: 'bar' | 'note' | 'empty'; barIndex: number; noteIndex?: number } {
  const els = document.elementsFromPoint(clientX, clientY)

  // Check notes first (more specific)
  for (const el of els) {
    const noteEl = el.closest('[class*="vf-stavenote"]')
    if (noteEl) {
      const measureEl = noteEl.closest('[class*="vf-measure"]')
      if (measureEl) {
        const idMatch = measureEl.id?.match(/(\d+)/)
        if (idMatch) {
          const barIndex = parseInt(idMatch[1], 10) - 1
          const noteEls = Array.from(measureEl.querySelectorAll('[class*="vf-stavenote"]'))
          const noteIndex = noteEls.indexOf(noteEl as Element)
          return { type: 'note', barIndex, noteIndex: noteIndex >= 0 ? noteIndex : 0 }
        }
      }
    }
  }

  // Check measures
  for (const el of els) {
    const measureEl = el.closest('[class*="vf-measure"]')
    if (measureEl && container.contains(measureEl)) {
      const idMatch = measureEl.id?.match(/(\d+)/)
      if (idMatch) {
        return { type: 'bar', barIndex: parseInt(idMatch[1], 10) - 1 }
      }
    }
  }

  return { type: 'empty', barIndex: -1 }
}
```

Import `ScoreOverlay` and `useScoreSync`, wrap the OSMD container with the overlay. After every OSMD `.render()` call, invoke `syncHighlights()`.

Update `handleCanvasClick` to use `findClickedElement` and route to note vs bar selection based on result type and current `toolMode`.

- [ ] **Step 4: Verify app renders, clicking bars highlights them**

Run: `pnpm dev` — click on bars in the score, verify the `lava-bar-selected` class appears (check via DevTools).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/score/ScoreOverlay.tsx client/src/hooks/useScoreSync.ts client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat(editor): ScoreOverlay, useScoreSync, findClickedElement with bar/note selection highlights"
```

---

## Task 9: Playback Cursor + Listening Highlight

**Files:**
- Create: `client/src/components/score/PlaybackCursor.tsx`
- Create: `client/src/hooks/usePlaybackCursor.ts`
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Create usePlaybackCursor hook**

Create `client/src/hooks/usePlaybackCursor.ts`:

```typescript
import { useRef, useEffect, useCallback } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import type { NoteOnset } from '@/lib/musicXmlEngine'

interface CursorPosition {
  x: number
  y: number
  height: number
}

export function usePlaybackCursor(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onsetMap: NoteOnset[],
  getMeasureBounds: (barIndex: number) => DOMRect | null
) {
  const posRef = useRef<CursorPosition>({ x: 0, y: 0, height: 0 })
  const cursorElRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number>(0)
  const prevNoteRef = useRef<Element | null>(null)

  const animate = useCallback(() => {
    const { playbackState, currentTime, currentBar } = useAudioStore.getState()
    const container = containerRef.current
    const cursorEl = cursorElRef.current

    if (!container || !cursorEl || playbackState !== 'playing') {
      cursorEl?.style.setProperty('opacity', '0')
      return
    }

    cursorEl.style.setProperty('opacity', '1')

    // Position cursor based on current bar bounds
    const bounds = getMeasureBounds(currentBar)
    if (bounds) {
      // Interpolate within the bar
      const barOnsets = onsetMap.filter((o) => o.barIndex === currentBar)
      let xOffset = 0
      if (barOnsets.length > 0) {
        const barStart = barOnsets[0].onsetTime
        const barEnd = barOnsets.length > 0
          ? barOnsets[barOnsets.length - 1].onsetTime + barOnsets[barOnsets.length - 1].duration
          : barStart + 1
        const progress = Math.min(1, Math.max(0, (currentTime - barStart) / (barEnd - barStart)))
        xOffset = progress * bounds.width
      }

      posRef.current = { x: bounds.x + xOffset, y: bounds.y, height: bounds.height }
      cursorEl.style.transform = `translateX(${posRef.current.x}px)`
      cursorEl.style.top = `${posRef.current.y}px`
      cursorEl.style.height = `${posRef.current.height}px`

      // Auto-scroll
      const containerRect = container.getBoundingClientRect()
      const cursorScreenX = containerRect.x + posRef.current.x
      if (cursorScreenX > containerRect.right - 100 || cursorScreenX < containerRect.left) {
        container.scrollTo({
          left: container.scrollLeft + posRef.current.x - 100,
          behavior: 'smooth',
        })
      }
    }

    // Note-level listening highlight
    if (prevNoteRef.current) {
      prevNoteRef.current.classList.remove('lava-note-playing')
      prevNoteRef.current = null
    }

    const activeOnset = onsetMap.find(
      (o) => currentTime >= o.onsetTime && currentTime < o.onsetTime + o.duration
    )
    if (activeOnset && container) {
      const measureEls = container.querySelectorAll('[class*="vf-measure"]')
      const measureEl = measureEls[activeOnset.barIndex]
      if (measureEl) {
        const noteEls = measureEl.querySelectorAll('[class*="vf-stavenote"]')
        const noteEl = noteEls[activeOnset.noteIndex]
        if (noteEl) {
          noteEl.classList.add('lava-note-playing')
          prevNoteRef.current = noteEl
        }
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [containerRef, onsetMap, getMeasureBounds])

  useEffect(() => {
    const unsub = useAudioStore.subscribe((s) => {
      if (s.playbackState === 'playing') {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        cancelAnimationFrame(rafRef.current)
        // Clean up note highlight
        if (prevNoteRef.current) {
          prevNoteRef.current.classList.remove('lava-note-playing')
          prevNoteRef.current = null
        }
      }
    })
    return () => {
      unsub()
      cancelAnimationFrame(rafRef.current)
    }
  }, [animate])

  return cursorElRef
}
```

- [ ] **Step 2: Create PlaybackCursor component**

Create `client/src/components/score/PlaybackCursor.tsx`:

```typescript
import { forwardRef } from 'react'
import { cn } from '@/components/ui/utils'

export const PlaybackCursor = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'absolute left-0 w-0.5 bg-accent opacity-0 transition-opacity duration-150 pointer-events-none z-20',
          className
        )}
        style={{ willChange: 'transform' }}
      />
    )
  }
)

PlaybackCursor.displayName = 'PlaybackCursor'
```

- [ ] **Step 3: Integrate PlaybackCursor into EditorCanvas**

In `EditorCanvas.tsx`, add the `PlaybackCursor` inside `ScoreOverlay`, wire `usePlaybackCursor` to the cursor ref, and build the onset map from `musicXml` and `bpm` using `buildNoteOnsetMap`.

- [ ] **Step 4: Verify cursor animates during playback**

Run: `pnpm dev` — press play, verify cursor sweeps across score, notes glow.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/score/PlaybackCursor.tsx client/src/hooks/usePlaybackCursor.ts client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat(editor): playback cursor with auto-scroll and karaoke-style note highlight"
```

---

## Task 10: Selection Rectangle (Range Tool)

**Files:**
- Create: `client/src/components/score/SelectionRect.tsx`
- Create: `client/src/hooks/useRangeSelect.ts`
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Create SelectionRect component**

Create `client/src/components/score/SelectionRect.tsx`:

```typescript
import { cn } from '@/components/ui/utils'

interface SelectionRectProps {
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  className?: string
}

export function SelectionRect({ x, y, width, height, visible, className }: SelectionRectProps) {
  if (!visible) return null
  return (
    <div
      className={cn(
        'absolute border border-accent/40 bg-accent/15 rounded-lg pointer-events-none z-20',
        className
      )}
      style={{
        left: Math.min(x, x + width),
        top: Math.min(y, y + height),
        width: Math.abs(width),
        height: Math.abs(height),
      }}
    />
  )
}
```

- [ ] **Step 2: Create useRangeSelect hook**

Create `client/src/hooks/useRangeSelect.ts`:

```typescript
import { useState, useCallback, useRef } from 'react'
import { useEditorStore } from '@/stores/editorStore'

interface RectState {
  x: number
  y: number
  width: number
  height: number
  visible: boolean
}

export function useRangeSelect(
  containerRef: React.RefObject<HTMLDivElement | null>,
  getMeasureBounds: (barIndex: number) => DOMRect | null,
  totalBars: number
) {
  const [rect, setRect] = useState<RectState>({ x: 0, y: 0, width: 0, height: 0, visible: false })
  const startRef = useRef({ x: 0, y: 0 })
  const selectRange = useEditorStore((s) => s.selectRange)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const x = e.clientX - containerRect.left + container.scrollLeft
    const y = e.clientY - containerRect.top + container.scrollTop
    startRef.current = { x, y }
    setRect({ x, y, width: 0, height: 0, visible: true })
  }, [containerRef])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rect.visible) return
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const x = e.clientX - containerRect.left + container.scrollLeft
    const y = e.clientY - containerRect.top + container.scrollTop
    setRect((prev) => ({
      ...prev,
      width: x - startRef.current.x,
      height: y - startRef.current.y,
    }))
  }, [rect.visible, containerRef])

  const onMouseUp = useCallback(() => {
    if (!rect.visible) return

    // Find bars that intersect the selection rectangle
    const selLeft = Math.min(rect.x, rect.x + rect.width)
    const selRight = Math.max(rect.x, rect.x + rect.width)
    const selTop = Math.min(rect.y, rect.y + rect.height)
    const selBottom = Math.max(rect.y, rect.y + rect.height)

    let startBar = -1
    let endBar = -1

    for (let i = 0; i < totalBars; i++) {
      const bounds = getMeasureBounds(i)
      if (!bounds) continue
      // Check intersection
      if (
        bounds.x < selRight &&
        bounds.x + bounds.width > selLeft &&
        bounds.y < selBottom &&
        bounds.y + bounds.height > selTop
      ) {
        if (startBar === -1) startBar = i
        endBar = i
      }
    }

    if (startBar >= 0 && endBar >= 0) {
      selectRange(startBar, endBar)
    }

    setRect((prev) => ({ ...prev, visible: false }))
  }, [rect, totalBars, getMeasureBounds, selectRange])

  return { rect, onMouseDown, onMouseMove, onMouseUp }
}
```

- [ ] **Step 3: Integrate range selection into EditorCanvas**

In `EditorCanvas.tsx`, when `toolMode === 'range'`, attach `useRangeSelect` mouse handlers to the score container. Render `SelectionRect` inside `ScoreOverlay`.

- [ ] **Step 4: Verify range drag selects bars**

Run: `pnpm dev` — switch to Range tool, click and drag across bars, verify rectangle appears and bars highlight on release.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/score/SelectionRect.tsx client/src/hooks/useRangeSelect.ts client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat(editor): range tool with drag-to-select rectangle"
```

---

## Task 11: Smart Context Pill

**Files:**
- Create: `client/src/components/score/ContextPill.tsx`
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Create ContextPill component**

Create `client/src/components/score/ContextPill.tsx`:

```typescript
import { useState } from 'react'
import { cn } from '@/components/ui/utils'
import { useEditorStore, type NoteRef } from '@/stores/editorStore'
import {
  Music, Copy, Trash2, ClipboardPaste, Repeat, Eraser,
  ArrowUpDown, Type, MoreHorizontal, Guitar, Clock
} from 'lucide-react'

type PillAction = {
  id: string
  label: string
  icon: React.ReactNode
  primary?: boolean
  onAction: () => void
}

interface ContextPillProps {
  x: number
  y: number
  visible: boolean
  selectionType: 'empty-bars' | 'content-bars' | 'single-note' | 'multi-notes' | null
  onChord: () => void
  onKeySig: () => void
  onDelete: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onTranspose: () => void
  onClearContents: () => void
  onText: () => void
  onPitch: () => void
  onDuration: () => void
  onAccidental: () => void
  onTieSlur: () => void
  onToggleRest: () => void
  onLyric: () => void
  className?: string
}

export function ContextPill({
  x, y, visible, selectionType,
  onChord, onKeySig, onDelete, onCopy, onPaste, onDuplicate,
  onTranspose, onClearContents, onText, onPitch, onDuration,
  onAccidental, onTieSlur, onToggleRest, onLyric, className,
}: ContextPillProps) {
  const [showOverflow, setShowOverflow] = useState(false)

  if (!visible || !selectionType) return null

  let primaryActions: PillAction[] = []
  let overflowActions: PillAction[] = []

  switch (selectionType) {
    case 'empty-bars':
      primaryActions = [
        { id: 'chord', label: 'Set Chord', icon: <Music className="size-3.5" />, primary: true, onAction: onChord },
        { id: 'key', label: 'Set Key', icon: <Music className="size-3.5" />, onAction: onKeySig },
      ]
      overflowActions = [
        { id: 'delete', label: 'Delete', icon: <Trash2 className="size-3.5" />, onAction: onDelete },
        { id: 'copy', label: 'Copy', icon: <Copy className="size-3.5" />, onAction: onCopy },
        { id: 'duplicate', label: 'Duplicate', icon: <Repeat className="size-3.5" />, onAction: onDuplicate },
        { id: 'text', label: 'Add Text', icon: <Type className="size-3.5" />, onAction: onText },
      ]
      break
    case 'content-bars':
      primaryActions = [
        { id: 'chord', label: 'Edit Chord', icon: <Music className="size-3.5" />, primary: true, onAction: onChord },
        { id: 'copy', label: 'Copy', icon: <Copy className="size-3.5" />, onAction: onCopy },
      ]
      overflowActions = [
        { id: 'delete', label: 'Delete', icon: <Trash2 className="size-3.5" />, onAction: onDelete },
        { id: 'duplicate', label: 'Duplicate', icon: <Repeat className="size-3.5" />, onAction: onDuplicate },
        { id: 'transpose', label: 'Transpose', icon: <ArrowUpDown className="size-3.5" />, onAction: onTranspose },
        { id: 'clear', label: 'Clear', icon: <Eraser className="size-3.5" />, onAction: onClearContents },
        { id: 'timeSig', label: 'Time Sig', icon: <Music className="size-3.5" />, onAction: onKeySig },
        { id: 'text', label: 'Add Text', icon: <Type className="size-3.5" />, onAction: onText },
      ]
      break
    case 'single-note':
      primaryActions = [
        { id: 'pitch', label: 'Pitch', icon: <Guitar className="size-3.5" />, primary: true, onAction: onPitch },
        { id: 'duration', label: 'Duration', icon: <Clock className="size-3.5" />, onAction: onDuration },
      ]
      overflowActions = [
        { id: 'delete', label: 'Delete', icon: <Trash2 className="size-3.5" />, onAction: onDelete },
        { id: 'accidental', label: 'Accidental', icon: <Music className="size-3.5" />, onAction: onAccidental },
        { id: 'tie', label: 'Tie/Slur', icon: <Music className="size-3.5" />, onAction: onTieSlur },
        { id: 'rest', label: 'Rest', icon: <Music className="size-3.5" />, onAction: onToggleRest },
        { id: 'lyric', label: 'Lyric', icon: <Type className="size-3.5" />, onAction: onLyric },
      ]
      break
    case 'multi-notes':
      primaryActions = [
        { id: 'transpose', label: 'Transpose', icon: <ArrowUpDown className="size-3.5" />, primary: true, onAction: onTranspose },
        { id: 'duration', label: 'Duration', icon: <Clock className="size-3.5" />, onAction: onDuration },
      ]
      overflowActions = [
        { id: 'delete', label: 'Delete', icon: <Trash2 className="size-3.5" />, onAction: onDelete },
        { id: 'copy', label: 'Copy', icon: <Copy className="size-3.5" />, onAction: onCopy },
        { id: 'accidental', label: 'Accidental', icon: <Music className="size-3.5" />, onAction: onAccidental },
        { id: 'rest', label: 'Rest', icon: <Music className="size-3.5" />, onAction: onToggleRest },
      ]
      break
  }

  return (
    <div
      className={cn(
        'absolute z-30 flex items-center gap-1 bg-surface-2 border border-border rounded-full px-2 py-1 shadow-lg animate-fade-in',
        className
      )}
      style={{
        left: x,
        top: y - 8,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {primaryActions.map((action) => (
        <button
          key={action.id}
          onClick={action.onAction}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors hover:bg-surface-3',
            action.primary ? 'text-text-primary font-medium' : 'text-text-secondary'
          )}
        >
          {action.icon}
          {action.label}
        </button>
      ))}

      {overflowActions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowOverflow(!showOverflow)}
            className="flex items-center px-1 py-0.5 rounded-full text-text-secondary hover:bg-surface-3"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
          {showOverflow && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-surface-2 border border-border rounded-lg shadow-xl py-1 min-w-[140px] z-40 animate-fade-in">
              {overflowActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => { action.onAction(); setShowOverflow(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrate ContextPill into EditorCanvas**

In `EditorCanvas.tsx`, compute pill position from selected bar/note bounds via `getMeasureBounds`/`getNoteBounds`. Determine `selectionType` based on what's selected and whether bars have content. Render `ContextPill` in `ScoreOverlay` and wire its callbacks to the appropriate engine functions + store updates.

- [ ] **Step 3: Verify context pill appears on selection**

Run: `pnpm dev` — click a bar, verify context pill appears above with appropriate actions.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/score/ContextPill.tsx client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat(editor): smart context pill with context-aware actions"
```

---

## Task 12: Mini Fretboard + Duration Palette

**Files:**
- Create: `client/src/components/score/MiniFretboard.tsx`
- Create: `client/src/components/score/DurationPalette.tsx`
- Create: `client/src/lib/chordVoicings.ts`

- [ ] **Step 1: Create chord voicings data**

Create `client/src/lib/chordVoicings.ts`:

```typescript
// Finger positions: -1 = muted, 0 = open, 1-12 = fret number
// Array index 0 = low E (6th string), index 5 = high E (1st string)
export interface ChordVoicing {
  name: string
  frets: [number, number, number, number, number, number]
  baseFret: number // 1 for open position chords
}

export const CHORD_VOICINGS: Record<string, ChordVoicing> = {
  'C':    { name: 'C',    frets: [-1, 3, 2, 0, 1, 0], baseFret: 1 },
  'D':    { name: 'D',    frets: [-1, -1, 0, 2, 3, 2], baseFret: 1 },
  'E':    { name: 'E',    frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
  'F':    { name: 'F',    frets: [1, 3, 3, 2, 1, 1], baseFret: 1 },
  'G':    { name: 'G',    frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
  'A':    { name: 'A',    frets: [-1, 0, 2, 2, 2, 0], baseFret: 1 },
  'B':    { name: 'B',    frets: [-1, 2, 4, 4, 4, 2], baseFret: 1 },
  'Am':   { name: 'Am',   frets: [-1, 0, 2, 2, 1, 0], baseFret: 1 },
  'Bm':   { name: 'Bm',   frets: [-1, 2, 4, 4, 3, 2], baseFret: 1 },
  'Cm':   { name: 'Cm',   frets: [-1, 3, 5, 5, 4, 3], baseFret: 1 },
  'Dm':   { name: 'Dm',   frets: [-1, -1, 0, 2, 3, 1], baseFret: 1 },
  'Em':   { name: 'Em',   frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
  'Fm':   { name: 'Fm',   frets: [1, 3, 3, 1, 1, 1], baseFret: 1 },
  'Gm':   { name: 'Gm',   frets: [3, 5, 5, 3, 3, 3], baseFret: 1 },
  'A7':   { name: 'A7',   frets: [-1, 0, 2, 0, 2, 0], baseFret: 1 },
  'B7':   { name: 'B7',   frets: [-1, 2, 1, 2, 0, 2], baseFret: 1 },
  'C7':   { name: 'C7',   frets: [-1, 3, 2, 3, 1, 0], baseFret: 1 },
  'D7':   { name: 'D7',   frets: [-1, -1, 0, 2, 1, 2], baseFret: 1 },
  'E7':   { name: 'E7',   frets: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  'G7':   { name: 'G7',   frets: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  'Am7':  { name: 'Am7',  frets: [-1, 0, 2, 0, 1, 0], baseFret: 1 },
  'Dm7':  { name: 'Dm7',  frets: [-1, -1, 0, 2, 1, 1], baseFret: 1 },
  'Em7':  { name: 'Em7',  frets: [0, 2, 0, 0, 0, 0], baseFret: 1 },
  'Cmaj7': { name: 'Cmaj7', frets: [-1, 3, 2, 0, 0, 0], baseFret: 1 },
  'Fmaj7': { name: 'Fmaj7', frets: [-1, -1, 3, 2, 1, 0], baseFret: 1 },
  'Gmaj7': { name: 'Gmaj7', frets: [3, 2, 0, 0, 0, 2], baseFret: 1 },
}
```

- [ ] **Step 2: Create MiniFretboard component**

Create `client/src/components/score/MiniFretboard.tsx`:

```typescript
import { cn } from '@/components/ui/utils'
import { STANDARD_TUNING, fretToMidi, midiToFret, type FretPosition } from '@/lib/pitchUtils'

interface MiniFretboardProps {
  currentMidi?: number
  onFretSelect: (midi: number) => void
  x: number
  y: number
  visible: boolean
  className?: string
}

const STRING_LABELS = ['E', 'B', 'G', 'D', 'A', 'E']
const FRET_COUNT = 12
const DOT_FRETS = [3, 5, 7, 9]
const DOUBLE_DOT_FRETS = [12]

export function MiniFretboard({ currentMidi, onFretSelect, x, y, visible, className }: MiniFretboardProps) {
  if (!visible) return null

  const currentPositions = currentMidi ? midiToFret(currentMidi, STANDARD_TUNING) : []

  const isHighlighted = (string: number, fret: number) =>
    currentPositions.some((p) => p.string === string && p.fret === fret)

  return (
    <div
      className={cn(
        'absolute bg-surface-1 border border-border rounded-lg shadow-xl p-3 z-40 animate-fade-in',
        className
      )}
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
    >
      {/* Fret numbers */}
      <div className="flex ml-8 mb-1">
        {Array.from({ length: FRET_COUNT + 1 }, (_, i) => (
          <div key={i} className="w-5 text-center text-[10px] text-text-muted">
            {i === 0 ? '' : i}
          </div>
        ))}
      </div>

      {/* Strings */}
      {STRING_LABELS.map((label, stringVisualIdx) => {
        const stringNum = stringVisualIdx + 1 // 1=high E, 6=low E
        return (
          <div key={stringNum} className="flex items-center h-5">
            <span className="w-8 text-right pr-2 text-[10px] text-text-secondary font-mono">
              {label}
            </span>
            {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => (
              <button
                key={fret}
                onClick={() => onFretSelect(fretToMidi(stringNum, fret, STANDARD_TUNING))}
                className={cn(
                  'w-5 h-5 flex items-center justify-center border-r border-border transition-colors',
                  fret === 0 ? 'border-r-2 border-r-text-primary' : '',
                  isHighlighted(stringNum, fret)
                    ? 'bg-accent text-surface-0 rounded-full'
                    : 'hover:bg-surface-3'
                )}
              >
                {isHighlighted(stringNum, fret) && (
                  <div className="size-3 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>
        )
      })}

      {/* Dot markers row */}
      <div className="flex ml-8 mt-1">
        {Array.from({ length: FRET_COUNT + 1 }, (_, i) => (
          <div key={i} className="w-5 flex justify-center">
            {DOT_FRETS.includes(i) && <div className="size-1.5 rounded-full bg-text-muted" />}
            {DOUBLE_DOT_FRETS.includes(i) && (
              <div className="flex gap-0.5">
                <div className="size-1.5 rounded-full bg-text-muted" />
                <div className="size-1.5 rounded-full bg-text-muted" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create DurationPalette component**

Create `client/src/components/score/DurationPalette.tsx`:

```typescript
import { cn } from '@/components/ui/utils'

type DurationType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th'

interface DurationPaletteProps {
  currentDuration?: string
  dotted?: boolean
  triplet?: boolean
  onDurationSelect: (type: DurationType, divisions: number) => void
  onToggleDot: () => void
  onToggleTriplet: () => void
  x: number
  y: number
  visible: boolean
  className?: string
}

const DURATIONS: { type: DurationType; label: string; divisions: number }[] = [
  { type: 'whole', label: '1', divisions: 4 },
  { type: 'half', label: '½', divisions: 2 },
  { type: 'quarter', label: '¼', divisions: 1 },
  { type: 'eighth', label: '⅛', divisions: 0.5 },
  { type: '16th', label: '1/16', divisions: 0.25 },
]

export function DurationPalette({
  currentDuration, dotted, triplet,
  onDurationSelect, onToggleDot, onToggleTriplet,
  x, y, visible, className,
}: DurationPaletteProps) {
  if (!visible) return null

  return (
    <div
      className={cn(
        'absolute bg-surface-1 border border-border rounded-lg shadow-xl p-2 z-40 animate-fade-in',
        className
      )}
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
    >
      {/* Duration buttons */}
      <div className="flex gap-1">
        {DURATIONS.map((d) => (
          <button
            key={d.type}
            onClick={() => onDurationSelect(d.type, d.divisions)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-xs transition-colors',
              currentDuration === d.type
                ? 'bg-surface-3 text-text-primary font-medium'
                : 'text-text-secondary hover:bg-surface-2'
            )}
          >
            <span className="text-sm font-mono">{d.label}</span>
          </button>
        ))}
      </div>

      {/* Dot + Triplet toggles */}
      <div className="flex gap-1 mt-1 pt-1 border-t border-border">
        <button
          onClick={onToggleDot}
          className={cn(
            'flex-1 text-center px-2 py-1 rounded-md text-xs transition-colors',
            dotted ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-2'
          )}
        >
          Dot •
        </button>
        <button
          onClick={onToggleTriplet}
          className={cn(
            'flex-1 text-center px-2 py-1 rounded-md text-xs transition-colors',
            triplet ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-2'
          )}
        >
          Triplet 3
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify components render**

Run: `pnpm typecheck` — no errors. Visually test by temporarily rendering them in EditorCanvas.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/chordVoicings.ts client/src/components/score/MiniFretboard.tsx client/src/components/score/DurationPalette.tsx
git commit -m "feat(editor): MiniFretboard, DurationPalette, and chord voicing data"
```

---

## Task 13: Chord Diagram + Popover (Training Wheels)

**Files:**
- Create: `client/src/components/score/ChordDiagram.tsx`
- Create: `client/src/components/score/ChordDiagramPopover.tsx`

- [ ] **Step 1: Create ChordDiagram SVG component**

Create `client/src/components/score/ChordDiagram.tsx`:

```typescript
import { cn } from '@/components/ui/utils'
import { type ChordVoicing } from '@/lib/chordVoicings'

interface ChordDiagramProps {
  voicing: ChordVoicing
  width?: number
  height?: number
  className?: string
}

export function ChordDiagram({ voicing, width = 40, height = 48, className }: ChordDiagramProps) {
  const strings = 6
  const frets = 4
  const padTop = 10
  const padLeft = 8
  const padRight = 4
  const fretH = (height - padTop) / frets
  const stringW = (width - padLeft - padRight) / (strings - 1)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('flex-shrink-0', className)}
    >
      {/* Chord name */}
      <text
        x={width / 2}
        y={8}
        textAnchor="middle"
        className="fill-text-primary text-[8px] font-medium"
      >
        {voicing.name}
      </text>

      {/* Nut (thick line at top for open position) */}
      {voicing.baseFret === 1 && (
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft + (strings - 1) * stringW}
          y2={padTop}
          className="stroke-text-primary"
          strokeWidth={2}
        />
      )}

      {/* Fret lines */}
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line
          key={`fret-${i}`}
          x1={padLeft}
          y1={padTop + i * fretH}
          x2={padLeft + (strings - 1) * stringW}
          y2={padTop + i * fretH}
          className="stroke-text-muted"
          strokeWidth={0.5}
        />
      ))}

      {/* String lines */}
      {Array.from({ length: strings }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={padLeft + i * stringW}
          y1={padTop}
          x2={padLeft + i * stringW}
          y2={padTop + frets * fretH}
          className="stroke-text-muted"
          strokeWidth={0.5}
        />
      ))}

      {/* Finger dots + muted/open markers */}
      {voicing.frets.map((fret, i) => {
        const x = padLeft + i * stringW
        if (fret === -1) {
          return (
            <text key={i} x={x} y={padTop - 2} textAnchor="middle" className="fill-text-muted text-[7px]">
              ×
            </text>
          )
        }
        if (fret === 0) {
          return (
            <circle key={i} cx={x} cy={padTop - 3} r={2} className="fill-none stroke-text-muted" strokeWidth={0.8} />
          )
        }
        const adjustedFret = fret - voicing.baseFret + 1
        return (
          <circle
            key={i}
            cx={x}
            cy={padTop + (adjustedFret - 0.5) * fretH}
            r={2.5}
            className="fill-text-primary"
          />
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Create ChordDiagramPopover**

Create `client/src/components/score/ChordDiagramPopover.tsx`:

```typescript
import { cn } from '@/components/ui/utils'
import { ChordDiagram } from './ChordDiagram'
import { CHORD_VOICINGS } from '@/lib/chordVoicings'

interface ChordDiagramPopoverProps {
  chordName: string
  x: number
  y: number
  visible: boolean
  className?: string
}

export function ChordDiagramPopover({ chordName, x, y, visible, className }: ChordDiagramPopoverProps) {
  if (!visible) return null

  const voicing = CHORD_VOICINGS[chordName]
  if (!voicing) return null

  return (
    <div
      className={cn(
        'absolute bg-surface-1 border border-border rounded-lg shadow-xl p-2 z-40 animate-fade-in',
        className
      )}
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
    >
      <ChordDiagram voicing={voicing} width={60} height={72} />
    </div>
  )
}
```

- [ ] **Step 3: Verify components render**

Run: `pnpm typecheck` — no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/score/ChordDiagram.tsx client/src/components/score/ChordDiagramPopover.tsx
git commit -m "feat(editor): guitar chord diagram SVG component and popover"
```

---

## Task 14: Lyric + Annotation Input Components

**Files:**
- Create: `client/src/components/score/LyricInput.tsx`
- Create: `client/src/components/score/AnnotationInput.tsx`

- [ ] **Step 1: Create LyricInput**

Create `client/src/components/score/LyricInput.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/components/ui/utils'

interface LyricInputProps {
  x: number
  y: number
  visible: boolean
  initialValue?: string
  onSubmit: (text: string) => void
  onAdvance: () => void  // Tab to next note
  onDismiss: () => void
  className?: string
}

export function LyricInput({ x, y, visible, initialValue = '', onSubmit, onAdvance, onDismiss, className }: LyricInputProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) {
      setValue(initialValue)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [visible, initialValue])

  if (!visible) return null

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSubmit(value)
          onAdvance()
        } else if (e.key === 'Tab') {
          e.preventDefault()
          onSubmit(value)
          onAdvance()
        } else if (e.key === ' ' || e.key === '-') {
          // Space or hyphen submits current syllable and advances
          onSubmit(value + (e.key === '-' ? '-' : ''))
          onAdvance()
          e.preventDefault()
        } else if (e.key === 'Escape') {
          onDismiss()
        }
      }}
      className={cn(
        'absolute bg-surface-1 border border-border rounded px-1 py-0.5 text-xs text-text-secondary italic',
        'outline-none focus:border-accent w-16 z-40',
        className
      )}
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
      placeholder="lyric..."
    />
  )
}
```

- [ ] **Step 2: Create AnnotationInput**

Create `client/src/components/score/AnnotationInput.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/components/ui/utils'

interface AnnotationInputProps {
  x: number
  y: number
  visible: boolean
  initialValue?: string
  onSubmit: (text: string) => void
  onDismiss: () => void
  className?: string
}

export function AnnotationInput({ x, y, visible, initialValue = '', onSubmit, onDismiss, className }: AnnotationInputProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) {
      setValue(initialValue)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [visible, initialValue])

  if (!visible) return null

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSubmit(value)
        } else if (e.key === 'Escape') {
          onDismiss()
        }
      }}
      className={cn(
        'absolute bg-surface-1 border border-border rounded px-1.5 py-0.5 text-xs text-text-primary font-medium',
        'outline-none focus:border-accent w-32 z-40',
        className
      )}
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
      placeholder="annotation..."
    />
  )
}
```

- [ ] **Step 3: Verify components render**

Run: `pnpm typecheck` — no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/score/LyricInput.tsx client/src/components/score/AnnotationInput.tsx
git commit -m "feat(editor): lyric and annotation inline input components"
```

---

## Task 15: Wire EditorPage Stubs (Add/Delete Bars) Through Engine

**Files:**
- Modify: `client/src/spaces/pack/EditorPage.tsx`

- [ ] **Step 1: Implement handleAddBar and handleDeleteBars**

In `EditorPage.tsx`, replace the TODO stubs (around lines 87–96) with real implementations that call the MusicXML engine:

```typescript
import { addBars, deleteBars } from '@/lib/musicXmlEngine'

// Replace handleAddBar (line 87-89):
const handleAddBar = useCallback(() => {
  const xml = useLeadSheetStore.getState().musicXml
  if (!xml) return
  const { selectedBars, pushUndo } = useEditorStore.getState()
  pushUndo(xml)
  const afterIndex = selectedBars.length > 0
    ? Math.max(...selectedBars)
    : -1 // will need to handle "append to end"
  const newXml = addBars(xml, Math.max(afterIndex, 0), 1)
  useLeadSheetStore.getState().setMusicXml(newXml)
  useEditorStore.getState().setSaveStatus('unsaved')
}, [])

// Replace handleDeleteBars (line 91-96):
const handleDeleteBars = useCallback(() => {
  const xml = useLeadSheetStore.getState().musicXml
  const { selectedBars, clearSelection, pushUndo } = useEditorStore.getState()
  if (!xml || selectedBars.length === 0) return
  pushUndo(xml)
  const newXml = deleteBars(xml, selectedBars)
  useLeadSheetStore.getState().setMusicXml(newXml)
  clearSelection()
  useEditorStore.getState().setSaveStatus('unsaved')
}, [])
```

- [ ] **Step 2: Update pushUndo to capture MusicXML**

In `editorStore.ts`, modify `pushUndo` to store the MusicXML string snapshot passed as argument (it already accepts a `snapshot: string` parameter):

The existing `pushUndo(snapshot)` already stores a string. The engine callers will pass `musicXml` as the snapshot. No change needed if the interface already works this way.

- [ ] **Step 3: Verify add/delete bars works**

Run: `pnpm dev` — select a bar, click delete, verify bar disappears. Click add, verify new bar appears.

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorPage.tsx
git commit -m "feat(editor): wire add/delete bars through MusicXML engine"
```

---

## Task 16: Extended Keyboard Shortcuts

**Files:**
- Modify: `client/src/hooks/useEditorKeyboard.ts`

- [ ] **Step 1: Add all new keyboard shortcuts**

Extend `useEditorKeyboard.ts` to handle:

```typescript
// Tool shortcuts (add to existing tool section around line 60):
case 'r': editorStore.setToolMode(editorStore.toolMode === 'range' ? 'pointer' : 'range'); break
case 'k': editorStore.setToolMode(editorStore.toolMode === 'keySig' ? 'pointer' : 'keySig'); break

// Note operations (only when notes are selected):
// Duration keys
case '1': case '2': case '3': case '4': case '5': {
  if (editorStore.selectedNotes.length === 0) break
  // Duration change via number key — handled by EditorCanvas which listens to a 'durationKey' event
  // Dispatch custom event for EditorCanvas to handle
  window.dispatchEvent(new CustomEvent('lava-duration-key', { detail: { key: e.key } }))
  break
}

// Arrow keys for pitch
case 'arrowup': case 'arrowdown': {
  if (editorStore.selectedNotes.length === 0) break
  e.preventDefault()
  const direction = e.key === 'arrowup' ? 1 : -1
  const octaveJump = e.shiftKey ? 7 : 1
  window.dispatchEvent(new CustomEvent('lava-pitch-step', { detail: { steps: direction * octaveJump } }))
  break
}

// Accidentals, ties, rests
case '#': window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'sharp' } })); break
case 'b': {
  if (editorStore.selectedNotes.length > 0) {
    window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'flat' } }))
  }
  break
}
case 'n': {
  if (editorStore.selectedNotes.length > 0) {
    window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'natural' } }))
  }
  break
}
case 'l': window.dispatchEvent(new CustomEvent('lava-toggle-tie')); break
case 'r': {
  // Only toggle rest if notes selected, otherwise it's the range tool
  if (editorStore.selectedNotes.length > 0) {
    window.dispatchEvent(new CustomEvent('lava-toggle-rest'))
  } else {
    editorStore.setToolMode(editorStore.toolMode === 'range' ? 'pointer' : 'range')
  }
  break
}

// Fretboard
case 'f': {
  if (editorStore.selectedNotes.length > 0) {
    window.dispatchEvent(new CustomEvent('lava-open-fretboard'))
  }
  break
}
// Duration palette
case 'd': {
  if (editorStore.selectedNotes.length > 0) {
    window.dispatchEvent(new CustomEvent('lava-open-duration'))
  }
  break
}

// Copy/Paste/Duplicate (add to Cmd section):
// Cmd+C
if (e.metaKey && e.key === 'c') {
  window.dispatchEvent(new CustomEvent('lava-copy'))
  break
}
// Cmd+V
if (e.metaKey && e.key === 'v') {
  window.dispatchEvent(new CustomEvent('lava-paste'))
  break
}
// Cmd+D
if (e.metaKey && e.key === 'd') {
  e.preventDefault()
  window.dispatchEvent(new CustomEvent('lava-duplicate'))
  break
}
// Cmd+Shift+Up/Down (transpose)
if (e.metaKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
  e.preventDefault()
  const semitones = e.key === 'ArrowUp' ? 1 : -1
  window.dispatchEvent(new CustomEvent('lava-transpose', { detail: { semitones } }))
  break
}

// Dot toggle
case '.': window.dispatchEvent(new CustomEvent('lava-toggle-dot')); break
// Triplet toggle (Shift+T)
case 'T': { // uppercase T = Shift+T
  if (e.shiftKey) window.dispatchEvent(new CustomEvent('lava-toggle-triplet'))
  break
}
```

- [ ] **Step 2: Verify shortcuts work**

Run: `pnpm dev` — test: press V (pointer), R (range), K (key sig). Select a bar, press Delete. Press Escape to clear.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useEditorKeyboard.ts
git commit -m "feat(editor): extended keyboard shortcuts for all tool and note operations"
```

---

## Task 17: Training Wheels Toolbar Toggles

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Add chord diagram and beat marker toggle buttons**

In `EditorToolbar.tsx`, add a new toolbar section after the view mode section (around line 265). Import `Guitar` and `Grid3x3` from `lucide-react`:

```typescript
// After the view mode section, add:
<Divider />

{/* Training wheels */}
<ToolButton
  icon={<Guitar className="size-4" />}
  label="Chord Shapes"
  active={showChordDiagrams}
  onClick={toggleChordDiagrams}
/>
<ToolButton
  icon={<Grid3x3 className="size-4" />}
  label="Beat Grid"
  active={showBeatMarkers}
  onClick={toggleBeatMarkers}
/>
```

Add the store selectors at the top of the component:

```typescript
const showChordDiagrams = useEditorStore((s) => s.showChordDiagrams)
const showBeatMarkers = useEditorStore((s) => s.showBeatMarkers)
const toggleChordDiagrams = useEditorStore((s) => s.toggleChordDiagrams)
const toggleBeatMarkers = useEditorStore((s) => s.toggleBeatMarkers)
```

- [ ] **Step 2: Verify toolbar renders with new buttons**

Run: `pnpm dev` — verify two new toggle buttons appear in the toolbar. Click them, verify they toggle active state.

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat(editor): add chord diagram and beat marker toolbar toggles"
```

---

## Task 18: Integration — Wire All Overlays into EditorCanvas

This is the integration task that connects all the components built in previous tasks into `EditorCanvas.tsx`.

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Import all new components and hooks**

Add imports for: `ScoreOverlay`, `PlaybackCursor`, `SelectionRect`, `ContextPill`, `MiniFretboard`, `DurationPalette`, `ChordDiagramPopover`, `LyricInput`, `AnnotationInput`, `useScoreSync`, `useRangeSelect`, `usePlaybackCursor`, `buildNoteOnsetMap`, and all relevant engine functions.

- [ ] **Step 2: Set up state for overlay components**

Add state for which overlays are visible and their positions:

```typescript
const [fretboardState, setFretboardState] = useState<{ visible: boolean; x: number; y: number; midi?: number }>({ visible: false, x: 0, y: 0 })
const [durationState, setDurationState] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 })
const [lyricState, setLyricState] = useState<{ visible: boolean; x: number; y: number; barIndex: number; noteIndex: number }>({ visible: false, x: 0, y: 0, barIndex: 0, noteIndex: 0 })
const [annotationState, setAnnotationState] = useState<{ visible: boolean; x: number; y: number; barIndex: number }>({ visible: false, x: 0, y: 0, barIndex: 0 })
const [chordDiagramHover, setChordDiagramHover] = useState<{ visible: boolean; x: number; y: number; chordName: string }>({ visible: false, x: 0, y: 0, chordName: '' })
```

- [ ] **Step 3: Wire ContextPill callbacks to engine functions**

Each callback should: get current musicXml → call engine function → update store → sync highlights. Example for chord:

```typescript
const handleContextChord = useCallback(() => {
  const bars = useEditorStore.getState().selectedBars
  if (bars.length > 0) {
    // Open chord popover at first selected bar
    const bounds = getMeasureBounds(bars[0])
    if (bounds) {
      setPopover({ type: 'chord', position: { x: bounds.x + bounds.width / 2, y: bounds.y }, barIndex: bars[0] })
    }
  }
}, [getMeasureBounds])
```

Wire all 15+ callbacks from ContextPill props to appropriate handlers.

- [ ] **Step 4: Listen for custom keyboard events from useEditorKeyboard**

Add `useEffect` listeners for the custom events (`lava-pitch-step`, `lava-duration-key`, `lava-accidental`, `lava-toggle-tie`, `lava-toggle-rest`, `lava-open-fretboard`, `lava-open-duration`, `lava-copy`, `lava-paste`, `lava-duplicate`, `lava-transpose`). Each listener calls the appropriate engine function and updates the store.

- [ ] **Step 5: Render all overlay components inside ScoreOverlay**

```tsx
<div className="relative flex-1 overflow-auto" ref={containerRef}>
  {/* OSMD renders here */}
  <div ref={osmdContainerRef} />

  <ScoreOverlay>
    <PlaybackCursor ref={cursorElRef} />
    <SelectionRect {...rangeRect} />
    <ContextPill
      x={pillPos.x}
      y={pillPos.y}
      visible={pillVisible}
      selectionType={selectionType}
      onChord={handleContextChord}
      // ... all other callbacks
    />
    <MiniFretboard {...fretboardState} onFretSelect={handleFretSelect} />
    <DurationPalette {...durationState} onDurationSelect={handleDurationSelect} onToggleDot={handleToggleDot} onToggleTriplet={handleToggleTriplet} />
    <LyricInput {...lyricState} onSubmit={handleLyricSubmit} onAdvance={handleLyricAdvance} onDismiss={() => setLyricState(s => ({ ...s, visible: false }))} />
    <AnnotationInput {...annotationState} onSubmit={handleAnnotationSubmit} onDismiss={() => setAnnotationState(s => ({ ...s, visible: false }))} />
    <ChordDiagramPopover {...chordDiagramHover} />
  </ScoreOverlay>
</div>
```

- [ ] **Step 6: Verify full integration**

Run: `pnpm dev` — test:
1. Click bar → highlights + context pill appears
2. Range tool → drag rectangle → bars highlight
3. Chord tool → click bar → popover opens
4. Play → cursor sweeps, notes glow
5. Training wheel toggles → chord diagram button, beat marker button

- [ ] **Step 7: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat(editor): integrate all overlay components into EditorCanvas"
```

---

## Task 19: Undo/Redo Snapshots

**Files:**
- Modify: `client/src/stores/editorStore.ts`
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Enhance undo/redo to restore MusicXML**

In `editorStore.ts`, modify `undo` and `redo` to also restore `musicXml` via `leadSheetStore.setMusicXml()`:

```typescript
undo: () => {
  set((s) => {
    if (s.undoStack.length === 0) return s
    const currentXml = useLeadSheetStore.getState().musicXml || ''
    const prevXml = s.undoStack[s.undoStack.length - 1]
    useLeadSheetStore.getState().setMusicXml(prevXml)
    return {
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, currentXml],
    }
  })
},
redo: () => {
  set((s) => {
    if (s.redoStack.length === 0) return s
    const currentXml = useLeadSheetStore.getState().musicXml || ''
    const nextXml = s.redoStack[s.redoStack.length - 1]
    useLeadSheetStore.getState().setMusicXml(nextXml)
    return {
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, currentXml],
    }
  })
},
```

- [ ] **Step 2: Verify undo/redo restores score state**

Run: `pnpm dev` — add a bar, undo, verify bar disappears. Redo, verify bar reappears.

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/editorStore.ts
git commit -m "feat(editor): undo/redo now restores MusicXML score state"
```

---

## Task 20: Beat Markers in useScoreSync

**Files:**
- Modify: `client/src/hooks/useScoreSync.ts`

- [ ] **Step 1: Add syncBeatMarkers function**

In `useScoreSync.ts`, add a `syncBeatMarkers` function that injects SVG `<line>` elements at beat boundaries within each measure when `showBeatMarkers` is enabled:

```typescript
const syncBeatMarkers = useCallback(() => {
  const container = containerRef.current
  if (!container) return

  // Remove existing beat markers
  container.querySelectorAll('.lava-beat-marker').forEach((el) => el.remove())
  container.querySelectorAll('.lava-beat-marker-downbeat').forEach((el) => el.remove())

  if (!showBeatMarkers) return

  const measureEls = container.querySelectorAll('[class*="vf-measure"]')
  measureEls.forEach((measureEl) => {
    const bbox = measureEl.getBBox ? (measureEl as SVGGraphicsElement).getBBox() : null
    if (!bbox) return

    const svgNS = 'http://www.w3.org/2000/svg'
    // Assume 4 beats per bar for now (read from time signature later)
    const beats = 4
    for (let beat = 0; beat <= beats; beat++) {
      const x = bbox.x + (beat / beats) * bbox.width
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', String(x))
      line.setAttribute('y1', String(bbox.y))
      line.setAttribute('x2', String(x))
      line.setAttribute('y2', String(bbox.y + bbox.height))
      line.classList.add(beat === 0 ? 'lava-beat-marker-downbeat' : 'lava-beat-marker')
      measureEl.appendChild(line)
    }
  })
}, [containerRef, showBeatMarkers])
```

Call `syncBeatMarkers()` at the end of `syncHighlights()`.

- [ ] **Step 2: Verify beat markers appear when toggled**

Run: `pnpm dev` — click the beat grid toggle, verify dashed lines appear between beats.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useScoreSync.ts
git commit -m "feat(editor): beat markers injected into OSMD SVG when toggled"
```

---

## Task 21: Click-to-Reposition Playhead

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Add click-to-reposition logic**

In `handleCanvasClick`, when the transport is stopped/paused and the user clicks a bar, also set `audioStore.currentBar`:

```typescript
// Inside handleCanvasClick, after selection logic:
const { transportState } = useAudioStore.getState()
if (transportState === 'stopped' || transportState === 'paused') {
  useAudioStore.getState().setCurrentBar(hit.barIndex)
}
```

- [ ] **Step 2: Verify clicking a bar moves the playhead**

Run: `pnpm dev` — click a bar while stopped, press play, verify playback starts from that bar.

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat(editor): click-to-reposition playhead on bar click when stopped"
```

---

## Task 22: Final Typecheck + Lint

**Files:** All modified files

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Fix any lint issues.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore(editor): fix lint and type errors from toolbar interactions feature"
```
