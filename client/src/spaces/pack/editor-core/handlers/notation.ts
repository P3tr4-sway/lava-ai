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
  track.notes = track.notes.map((note) =>
    note.id === cmd.noteId ? { ...note, tieStart: !note.tieStart } : note,
  )
  return { document: next, warnings: [] }
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
