import type { CommandResult, NoteValue, ScoreCommand, ScoreDocument, ScorePitch } from '@lava/shared'
import { choosePlacement, cloneDocument, divisionsToNoteType, noteTypeToDivisions, DEFAULT_PLACEMENT_POLICY, createId } from '../helpers'
import { midiToPitch, pitchToMidi } from '@/lib/pitchUtils'

const NOTE_VALUES: NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']

/**
 * Decompose a total duration (in divisions) into (type, dots) so that
 * computeEffectiveDuration(result) === totalDivisions whenever possible.
 * `exact` is false when no clean dotted representation exists, in which case
 * the result is the largest fitting base value with dots=0 (caller should warn).
 */
function decomposeDuration(
  totalDivisions: number,
  divisions: number,
): { type: NoteValue; dots: number; base: number; exact: boolean } {
  for (const type of NOTE_VALUES) {
    const base = noteTypeToDivisions(type, divisions)
    if (base === totalDivisions) return { type, dots: 0, base, exact: true }
    if (base + Math.floor(base / 2) === totalDivisions) return { type, dots: 1, base, exact: true }
    if (base + Math.floor(base / 2) + Math.floor(base / 4) === totalDivisions) {
      return { type, dots: 2, base, exact: true }
    }
  }
  const type = divisionsToNoteType(totalDivisions, divisions)
  return { type, dots: 0, base: noteTypeToDivisions(type, divisions), exact: false }
}

export function handleMoveNoteToBeat(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'moveNoteToBeat' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes
    .map((note) => {
      if (note.id !== cmd.noteId) return note
      const nextString = cmd.string ?? note.placement?.string
      const nextPlacement =
        nextString && note.placement
          ? { ...note.placement, string: nextString }
          : note.placement
      return {
        ...note,
        measureIndex: cmd.measureIndex,
        beat: cmd.beat,
        placement: nextPlacement,
      }
    })
    .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
  return { document: next, warnings: [] }
}

export function handleSplitNote(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'splitNote' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  const original = track.notes.find((n) => n.id === cmd.noteId)
  if (!original) return { document: next, warnings: [`Note not found: ${cmd.noteId}`] }
  const rightDuration = Math.max(1, original.durationDivisions - cmd.leftDurationDivisions)
  track.notes = track.notes.flatMap((note) => {
    if (note.id !== cmd.noteId) return [note]
    return [
      {
        ...note,
        durationDivisions: cmd.leftDurationDivisions,
        durationType: divisionsToNoteType(cmd.leftDurationDivisions, next.divisions),
      },
      {
        ...note,
        id: createId('note'),
        beat: note.beat + cmd.leftDurationDivisions / next.divisions,
        durationDivisions: rightDuration,
        durationType: divisionsToNoteType(rightDuration, next.divisions),
      },
    ]
  })
  return { document: next, warnings: [] }
}

export function handleMergeWithNext(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'mergeWithNext' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  const ordered = track.notes
    .slice()
    .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
  const index = ordered.findIndex((n) => n.id === cmd.noteId)
  const current = ordered[index]
  const nextNote = index >= 0 ? ordered[index + 1] : null
  if (!current || !nextNote) return { document: next, warnings: [] }
  if (current.measureIndex !== nextNote.measureIndex) return { document: next, warnings: [] }

  const total = current.durationDivisions + nextNote.durationDivisions
  const { type, dots, base, exact } = decomposeDuration(total, next.divisions)
  const warnings: string[] = exact
    ? []
    : ['Merged duration could not be expressed exactly; truncated to nearest note value.']

  track.notes = ordered
    .filter((n) => n.id !== nextNote.id)
    .map((n) =>
      n.id === current.id
        ? {
            ...n,
            durationDivisions: base,
            durationType: type,
            dots,
          }
        : n,
    )
  return { document: next, warnings }
}

export function handleTransposeSelection(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'transposeSelection' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  const targetNotes = new Set(
    cmd.noteIds ??
      track.notes
        .filter((note) => {
          if (!cmd.measureRange) return true
          return (
            note.measureIndex >= cmd.measureRange[0] &&
            note.measureIndex <= cmd.measureRange[1]
          )
        })
        .map((note) => note.id),
  )
  track.notes = track.notes.map((note) => {
    if (!targetNotes.has(note.id) || !note.pitch) return note
    const nextPitchRaw = midiToPitch(pitchToMidi(note.pitch) + cmd.semitones)
    const nextPitch: ScorePitch = {
      step: nextPitchRaw.step as ScorePitch['step'],
      octave: nextPitchRaw.octave,
      alter: nextPitchRaw.alter,
    }
    const placement = choosePlacement(
      pitchToMidi(nextPitch),
      track.tuning,
      track.capo,
      note.placement,
    )
    return { ...note, pitch: nextPitch, placement }
  })
  return { document: next, warnings: [] }
}
