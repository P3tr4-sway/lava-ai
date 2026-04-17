import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { cloneDocument } from '../helpers'

/** Cycles dots: 0 → 1 → 2 → 0 */
export function handleToggleDot(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'toggleDot' }>,
): CommandResult {
  const next = cloneDocument(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      note.dots = (note.dots + 1) % 3
      break
    }
  }
  return { document: next, warnings: [] }
}

/**
 * Adds a tuplet when not present, or removes it when the same ratio is already set.
 */
export function handleToggleTuplet(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'toggleTuplet' }>,
): CommandResult {
  const next = cloneDocument(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      if (
        note.tuplet &&
        note.tuplet.actual === cmd.actual &&
        note.tuplet.normal === cmd.normal
      ) {
        delete note.tuplet
      } else {
        note.tuplet = { actual: cmd.actual, normal: cmd.normal }
      }
      break
    }
  }
  return { document: next, warnings: [] }
}

export function handleToggleTie(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'toggleTie' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }

  const current = track.notes.find((n) => n.id === cmd.noteId)
  if (!current) return { document: next, warnings: [`Note not found: ${cmd.noteId}`] }

  // Find the next note in the same voice, sorted by (measure, beat),
  // ignoring chord-mates that share the same beat.
  const ordered = track.notes
    .filter((n) => n.voice === current.voice)
    .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
  const currentIndex = ordered.findIndex((n) => n.id === current.id)
  const nextNote = ordered
    .slice(currentIndex + 1)
    .find(
      (n) =>
        !(n.measureIndex === current.measureIndex && Math.abs(n.beat - current.beat) < 1e-6),
    )

  // A tie must connect two same-pitch notes (hard constraint).
  // If the current note already has a tie, we always allow toggling it off.
  const sameStep = nextNote?.pitch?.step === current.pitch?.step
  const sameOctave = nextNote?.pitch?.octave === current.pitch?.octave
  const sameAlter = (nextNote?.pitch?.alter ?? 0) === (current.pitch?.alter ?? 0)
  const canTie =
    !!nextNote &&
    !nextNote.isRest &&
    !!nextNote.pitch &&
    !!current.pitch &&
    !current.isRest &&
    sameStep &&
    sameOctave &&
    sameAlter

  const turningOn = !current.tieStart
  const warnings: string[] = []

  if (turningOn && !canTie) {
    warnings.push('Tie requires the next note in this voice to have the same pitch.')
    return { document: next, warnings }
  }

  track.notes = track.notes.map((note) => {
    if (note.id === current.id) {
      return { ...note, tieStart: turningOn }
    }
    if (nextNote && note.id === nextNote.id) {
      return { ...note, tieStop: turningOn }
    }
    return note
  })
  return { document: next, warnings }
}

export function handleToggleSlur(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'toggleSlur' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes.map((note) =>
    note.id === cmd.noteId ? { ...note, slurStart: !note.slurStart } : note,
  )
  return { document: next, warnings: [] }
}
