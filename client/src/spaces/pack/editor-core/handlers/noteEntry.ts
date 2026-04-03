import type { CommandResult, ScoreCommand, ScoreDocument, ScoreNoteEvent } from '@lava/shared'
import {
  createId,
  noteTypeToDivisions,
  resolvePitchFromPlacement,
} from '../helpers'

function cloneDocument(doc: ScoreDocument): ScoreDocument {
  return {
    ...doc,
    measures: doc.measures.map((m) => ({ ...m, harmony: [...m.harmony], annotations: [...m.annotations] })),
    tracks: doc.tracks.map((t) => ({ ...t, notes: t.notes.map((n) => ({ ...n, techniques: [...n.techniques] })) })),
  }
}

export function handleInsertNote(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'insertNote' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const warnings: string[] = []

  const track = next.tracks.find((t) => t.id === cmd.trackId) ?? next.tracks[0]
  if (!track) return { document: next, warnings: ['No editable guitar track found.'] }

  const inferredPlacement = cmd.note?.placement ?? { string: 1, fret: 0, confidence: 'low' as const }
  const inferredPitch = cmd.note?.pitch ?? resolvePitchFromPlacement(inferredPlacement, track.tuning, track.capo)

  const newNote: ScoreNoteEvent = {
    id: createId('note'),
    measureIndex: cmd.measureIndex,
    voice: 1,
    beat: cmd.beat,
    durationDivisions: cmd.note?.durationDivisions ?? noteTypeToDivisions(cmd.note?.durationType ?? 'quarter', next.divisions),
    durationType: cmd.note?.durationType ?? 'quarter',
    dots: cmd.note?.dots ?? 0,
    isRest: cmd.note?.isRest ?? false,
    pitch: inferredPitch,
    placement: inferredPlacement,
    techniques: Array.isArray(cmd.note?.techniques) ? cmd.note.techniques : [],
    lyric: cmd.note?.lyric,
    tieStart: cmd.note?.tieStart,
    tieStop: cmd.note?.tieStop,
    displayHints: cmd.note?.displayHints ?? { staffVisible: true, tabVisible: true },
  }

  track.notes = [...track.notes, newNote].sort(
    (a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat,
  )

  return { document: next, warnings }
}

export function handleInsertNoteAtCaret(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'insertNoteAtCaret' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const warnings: string[] = []

  const track = next.tracks.find((t) => t.id === cmd.trackId) ?? next.tracks[0]
  if (!track) return { document: next, warnings: ['No editable guitar track found.'] }

  if (cmd.measureIndex < 0 || cmd.measureIndex >= next.measures.length) {
    warnings.push(`Measure index ${cmd.measureIndex} is out of bounds.`)
    return { document: next, warnings }
  }

  const existing = track.notes.find(
    (note) =>
      note.measureIndex === cmd.measureIndex &&
      Math.abs(note.beat - cmd.beat) < 0.02 &&
      note.placement?.string === cmd.string,
  )

  if (existing) {
    track.notes = track.notes.map((note) =>
      note.id === existing.id
        ? {
            ...note,
            isRest: false,
            durationType: cmd.durationType ?? note.durationType,
            durationDivisions: noteTypeToDivisions(
              cmd.durationType ?? note.durationType,
              next.divisions,
            ),
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
    return { document: next, warnings }
  }

  const placement = {
    string: cmd.string,
    fret: cmd.fret,
    confidence: 'explicit' as const,
  }
  const durationType = cmd.durationType ?? 'quarter'

  const newNote: ScoreNoteEvent = {
    id: createId('note'),
    measureIndex: cmd.measureIndex,
    voice: 1,
    beat: cmd.beat,
    durationDivisions: noteTypeToDivisions(durationType, next.divisions),
    durationType,
    dots: 0,
    isRest: false,
    pitch: resolvePitchFromPlacement(placement, track.tuning, track.capo),
    placement,
    techniques: [],
    displayHints: { staffVisible: true, tabVisible: true },
  }

  track.notes = [...track.notes, newNote].sort(
    (a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat,
  )

  return { document: next, warnings }
}

export function handleInsertRestAtCaret(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'insertRestAtCaret' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const warnings: string[] = []

  const track = next.tracks.find((t) => t.id === cmd.trackId) ?? next.tracks[0]
  if (!track) return { document: next, warnings: ['No editable guitar track found.'] }

  const durationType = cmd.durationType ?? 'quarter'

  const existing = track.notes.find(
    (note) =>
      note.measureIndex === cmd.measureIndex &&
      Math.abs(note.beat - cmd.beat) < 0.02,
  )

  if (existing) {
    track.notes = track.notes.map((note) =>
      note.id === existing.id
        ? {
            ...note,
            isRest: true,
            durationType,
            durationDivisions: noteTypeToDivisions(durationType, next.divisions),
            placement: null,
            pitch: null,
          }
        : note,
    )
    return { document: next, warnings }
  }

  const newNote: ScoreNoteEvent = {
    id: createId('note'),
    measureIndex: cmd.measureIndex,
    voice: 1,
    beat: cmd.beat,
    durationDivisions: noteTypeToDivisions(durationType, next.divisions),
    durationType,
    dots: 0,
    isRest: true,
    pitch: null,
    placement: null,
    techniques: [],
    displayHints: { staffVisible: true, tabVisible: true },
  }

  track.notes = [...track.notes, newNote].sort(
    (a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat,
  )

  return { document: next, warnings }
}

/** Accepts the full deleteNote command shape but only noteId is required for the lookup */
export function handleDeleteNote(
  doc: ScoreDocument,
  cmd: { type: 'deleteNote'; noteId: string; trackId?: string },
): CommandResult {
  const next = cloneDocument(doc)
  const warnings: string[] = []

  if (cmd.trackId) {
    const track = next.tracks.find((t) => t.id === cmd.trackId)
    if (!track) {
      warnings.push(`Track ${cmd.trackId} not found.`)
      return { document: next, warnings }
    }
    track.notes = track.notes.filter((note) => note.id !== cmd.noteId)
  } else {
    // Search across all tracks when trackId is not provided
    for (const track of next.tracks) {
      track.notes = track.notes.filter((note) => note.id !== cmd.noteId)
    }
  }

  return { document: next, warnings }
}
