import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { choosePlacement } from '../helpers'
import { pitchToMidi } from '@/lib/pitchUtils'

function cloneDocument(doc: ScoreDocument): ScoreDocument {
  return structuredClone(doc)
}

export function handleSetTempo(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setTempo' }>,
): CommandResult {
  const next = cloneDocument(doc)
  next.tempo = Math.max(1, cmd.bpm)
  return { document: next, warnings: [] }
}

export function handleSetKeySignature(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setKeySignature' }>,
): CommandResult {
  const next = cloneDocument(doc)
  next.keySignature = { key: cmd.key, mode: cmd.mode }
  return { document: next, warnings: [] }
}

export function handleSetTimeSignature(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setTimeSignature' }>,
): CommandResult {
  const next = cloneDocument(doc)
  next.meter = { numerator: cmd.numerator, denominator: cmd.denominator }
  return { document: next, warnings: [] }
}

export function handleSetTrackClef(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setTrackClef' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (track) track.clef = cmd.clef
  return { document: next, warnings: [] }
}

export function handleSetCapo(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setCapo' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.capo = cmd.capo
  track.notes = track.notes.map((note) => {
    if (!note.pitch) return note
    const placement = choosePlacement(pitchToMidi(note.pitch), track.tuning, track.capo, note.placement)
    return { ...note, placement }
  })
  return { document: next, warnings: [] }
}

/**
 * Handles both setTuning and changeTuning — both update tuning and re-resolve placements.
 */
export function handleChangeTuning(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'changeTuning' }> | Extract<ScoreCommand, { type: 'setTuning' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.tuning = [...cmd.tuning]
  track.notes = track.notes.map((note) => {
    if (!note.pitch) return note
    const placement = choosePlacement(pitchToMidi(note.pitch), track.tuning, track.capo, note.placement)
    return { ...note, placement }
  })
  return { document: next, warnings: [] }
}
