import type { NoteValue, ScoreNoteEvent, TimeSignature } from '@lava/shared'
import { noteTypeToDivisions } from './helpers'

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
      validated.push(note)
    } else {
      const truncatedType = findClosestDurationType(remaining, divisions)
      const truncatedDivisions = noteTypeToDivisions(truncatedType, divisions)
      validated.push({
        ...note,
        durationType: truncatedType,
        durationDivisions: truncatedDivisions,
        dots: 0,
        tuplet: undefined,
      })
    }
  }

  return [...otherNotes, ...validated]
}
