import type {
  GuitarPlacement,
  KeySignature,
  NoteValue,
  PlacementPolicy,
  ScoreDocument,
  ScoreMeasureMeta,
  ScoreNoteEvent,
  ScorePitch,
  ScoreTrack,
  TimeSignature,
} from '@lava/shared'
import { fretToMidi, midiToFret, midiToPitch, pitchToMidi } from '@/lib/pitchUtils'

// --- ID generation ---
export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
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
  const divisor = NOTE_TYPE_TO_DIVISOR[type] ?? 4
  return Math.max(1, Math.round((divisions * 4) / divisor))
}

export function divisionsToNoteType(durationDivisions: number, divisions: number): NoteValue {
  const ratio = durationDivisions / Math.max(divisions, 1)
  if (ratio >= 4) return 'whole'
  if (ratio >= 2) return 'half'
  if (ratio >= 1) return 'quarter'
  if (ratio >= 0.5) return 'eighth'
  return 'sixteenth'
}

// --- Default placement policy ---
export const DEFAULT_PLACEMENT_POLICY: PlacementPolicy = {
  preferMinimalMovement: true,
  preferStringContinuity: true,
  maxFret: 18,
}

// --- Pitch / fret resolution ---
export function choosePlacement(
  midi: number,
  tuning: number[],
  capo: number,
  previous: GuitarPlacement | null,
  policy: PlacementPolicy = DEFAULT_PLACEMENT_POLICY,
): GuitarPlacement | null {
  const effectiveTuning = tuning.map((value) => value + capo)
  const candidates = midiToFret(midi, effectiveTuning).filter(
    (candidate) => candidate.fret <= policy.maxFret,
  )
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const prevDistanceA = previous
      ? Math.abs(previous.fret - a.fret) + Math.abs(previous.string - a.string)
      : 0
    const prevDistanceB = previous
      ? Math.abs(previous.fret - b.fret) + Math.abs(previous.string - b.string)
      : 0
    if (policy.preferMinimalMovement && prevDistanceA !== prevDistanceB)
      return prevDistanceA - prevDistanceB
    if (policy.preferStringContinuity && previous && a.string !== b.string) {
      return Math.abs(previous.string - a.string) - Math.abs(previous.string - b.string)
    }
    return a.fret - b.fret
  })

  const best = candidates[0]
  return {
    string: best.string,
    fret: best.fret,
    confidence: previous ? 'derived' : 'low',
  }
}

export function resolvePitchFromPlacement(
  placement: GuitarPlacement,
  tuning: number[],
  capo: number,
): ScorePitch {
  const midi = fretToMidi(placement.string, placement.fret, tuning.map((v) => v + capo))
  const pitch = midiToPitch(midi)
  return {
    step: pitch.step as ScorePitch['step'],
    octave: pitch.octave,
    alter: pitch.alter,
  }
}

// --- Measure helpers ---
export function getEffectiveTimeSignature(
  doc: ScoreDocument,
  measureIndex: number,
): TimeSignature {
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
  return {
    ...track,
    notes: updater(track.notes).sort(
      (a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat,
    ),
  }
}

// --- Measure metadata ---
export function createMeasureMeta(index: number): ScoreMeasureMeta {
  return {
    id: createId(`measure-${index}`),
    index,
    harmony: [],
    annotations: [],
    chordDiagramPlacement: 'hidden',
  }
}

// --- Pitch utilities (convenience wrappers) ---
export function pitchToMidiHelper(pitch: ScorePitch): number {
  return pitchToMidi(pitch)
}
