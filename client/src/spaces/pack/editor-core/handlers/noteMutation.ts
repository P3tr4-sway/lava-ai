import type { CommandResult, ScoreCommand, ScoreDocument, ScorePitch } from '@lava/shared'
import { choosePlacement, cloneDocument, divisionsToNoteType, DEFAULT_PLACEMENT_POLICY, createId } from '../helpers'
import { midiToPitch, pitchToMidi } from '@/lib/pitchUtils'

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
  track.notes = ordered
    .filter((n) => n.id !== nextNote.id)
    .map((n) =>
      n.id === current.id
        ? {
            ...n,
            durationDivisions: n.durationDivisions + nextNote.durationDivisions,
            durationType: divisionsToNoteType(
              n.durationDivisions + nextNote.durationDivisions,
              next.divisions,
            ),
          }
        : n,
    )
  return { document: next, warnings: [] }
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
