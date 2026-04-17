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
 * Validate all notes in a specific measure and normalize any constraint violations:
 *  1. Drop notes starting at or beyond measure capacity.
 *  2. Truncate notes whose effective end exceeds capacity.
 *  3. Truncate notes whose effective end overlaps the next chord group's start
 *     (within the same voice). Chord tones at the same beat are treated as one
 *     group and each tone is capped independently.
 *
 * Returns a new array of notes (does not mutate input).
 */
export function validateAndTruncate(
  allNotes: ScoreNoteEvent[],
  measureIndex: number,
  meter: TimeSignature,
  divisions: number,
): ScoreNoteEvent[] {
  const capacity = getMeasureCapacity(meter, divisions)

  const otherNotes = allNotes.filter((n) => n.measureIndex !== measureIndex)
  const inMeasure = allNotes.filter((n) => n.measureIndex === measureIndex)

  // Group by voice — overlaps are only meaningful within the same voice.
  const byVoice = new Map<number, ScoreNoteEvent[]>()
  for (const note of inMeasure) {
    const list = byVoice.get(note.voice) ?? []
    list.push(note)
    byVoice.set(note.voice, list)
  }

  const validated: ScoreNoteEvent[] = []

  for (const voiceNotes of byVoice.values()) {
    voiceNotes.sort((a, b) => a.beat - b.beat)

    // Build chord groups (notes sharing beat within the voice).
    const groups: { start: number; notes: ScoreNoteEvent[] }[] = []
    for (const note of voiceNotes) {
      const start = Math.round(note.beat * divisions)
      const last = groups[groups.length - 1]
      if (last && last.start === start) {
        last.notes.push(note)
      } else {
        groups.push({ start, notes: [note] })
      }
    }

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g]
      if (group.start >= capacity) continue

      const next = groups[g + 1]
      // Hard upper bound for any note in this group: next group's start, or capacity.
      const bound = Math.min(next ? next.start : capacity, capacity)
      const maxDur = bound - group.start

      for (const note of group.notes) {
        const effectiveDur = computeEffectiveDuration(note, divisions)
        if (effectiveDur <= maxDur) {
          validated.push(note)
        } else {
          const truncatedType = findClosestDurationType(maxDur, divisions)
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
    }
  }

  return [...otherNotes, ...validated]
}
