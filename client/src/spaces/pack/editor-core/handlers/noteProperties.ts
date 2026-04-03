import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import {
  choosePlacement,
  noteTypeToDivisions,
  resolvePitchFromPlacement,
  DEFAULT_PLACEMENT_POLICY,
} from '../helpers'
import { pitchToMidi } from '@/lib/pitchUtils'

function cloneDocument(doc: ScoreDocument): ScoreDocument {
  return structuredClone(doc)
}

export function handleSetDuration(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setDuration' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes.map((note) =>
    note.id === cmd.noteId
      ? {
          ...note,
          durationType: cmd.durationType,
          durationDivisions:
            cmd.durationDivisions > 0
              ? cmd.durationDivisions
              : noteTypeToDivisions(cmd.durationType, next.divisions),
        }
      : note,
  )
  return { document: next, warnings: [] }
}

export function handleSetPitch(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setPitch' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const warnings: string[] = []
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes.map((note) => {
    if (note.id !== cmd.noteId) return note
    const updated = { ...note, isRest: cmd.pitch === null, pitch: cmd.pitch }
    if (cmd.pitch) {
      const placement = choosePlacement(
        pitchToMidi(cmd.pitch),
        track.tuning,
        track.capo,
        note.placement,
      )
      updated.placement = placement
      if (!placement) {
        warnings.push(`No playable placement found for ${cmd.pitch.step}${cmd.pitch.octave}.`)
      }
    } else {
      updated.placement = null
    }
    return updated
  })
  return { document: next, warnings }
}

export function handleSetStringFret(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setStringFret' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes.map((note) =>
    note.id === cmd.noteId
      ? {
          ...note,
          isRest: false,
          placement: {
            string: cmd.string,
            fret: cmd.fret,
            confidence: 'explicit' as const,
          },
          pitch: resolvePitchFromPlacement(
            { string: cmd.string, fret: cmd.fret, confidence: 'explicit' as const },
            track.tuning,
            track.capo,
          ),
        }
      : note,
  )
  return { document: next, warnings: [] }
}

export function handleToggleRest(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'toggleRest' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes.map((note) =>
    note.id === cmd.noteId
      ? {
          ...note,
          isRest: !note.isRest,
          placement: note.isRest
            ? (note.placement ?? { string: 1, fret: 0, confidence: 'low' as const })
            : null,
          pitch: note.isRest ? (note.pitch ?? { step: 'E' as const, octave: 4 }) : null,
        }
      : note,
  )
  return { document: next, warnings: [] }
}

export function handleSetNoteDynamic(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setNoteDynamic' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes.map((note) => {
    if (note.id !== cmd.noteId) return note
    if (cmd.dynamic === null) {
      const { dynamic: _removed, ...rest } = note
      return rest
    }
    return { ...note, dynamic: cmd.dynamic }
  })
  return { document: next, warnings: [] }
}

export function handleSimplifyFingering(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'simplifyFingering' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const track = next.tracks.find((t) => t.id === cmd.trackId)
  if (!track) return { document: next, warnings: [`Track not found: ${cmd.trackId}`] }
  track.notes = track.notes.map((note) => {
    if (!note.pitch) return note
    const placement = choosePlacement(
      pitchToMidi(note.pitch),
      track.tuning,
      track.capo,
      null,
      DEFAULT_PLACEMENT_POLICY,
    )
    return { ...note, placement }
  })
  return { document: next, warnings: [] }
}
