import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { createMeasureMeta } from '../helpers'

function cloneDocument(doc: ScoreDocument): ScoreDocument {
  return structuredClone(doc)
}

export function handleAddMeasureBefore(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'addMeasureBefore' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const newMeasures = Array.from({ length: cmd.count }, (_, idx) =>
    createMeasureMeta(cmd.beforeIndex + idx),
  )
  const prefix = next.measures.slice(0, cmd.beforeIndex)
  const suffix = next.measures.slice(cmd.beforeIndex).map((measure) => ({
    ...measure,
    index: measure.index + cmd.count,
  }))
  next.measures = [...prefix, ...newMeasures, ...suffix]
  for (const track of next.tracks) {
    track.notes = track.notes.map((note) => ({
      ...note,
      measureIndex:
        note.measureIndex >= cmd.beforeIndex
          ? note.measureIndex + cmd.count
          : note.measureIndex,
    }))
  }
  return { document: next, warnings: [] }
}

export function handleAddMeasureAfter(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'addMeasureAfter' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const newMeasures = Array.from({ length: cmd.count }, (_, idx) =>
    createMeasureMeta(cmd.afterIndex + idx + 1),
  )
  const prefix = next.measures.slice(0, cmd.afterIndex + 1)
  const suffix = next.measures.slice(cmd.afterIndex + 1).map((measure) => ({
    ...measure,
    index: measure.index + cmd.count,
  }))
  next.measures = [...prefix, ...newMeasures, ...suffix]
  for (const track of next.tracks) {
    track.notes = track.notes.map((note) => ({
      ...note,
      measureIndex:
        note.measureIndex > cmd.afterIndex
          ? note.measureIndex + cmd.count
          : note.measureIndex,
    }))
  }
  return { document: next, warnings: [] }
}

export function handleDeleteMeasureRange(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'deleteMeasureRange' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const [start, end] = [cmd.start, cmd.end]
  const deleteCount = end - start + 1
  if (deleteCount >= next.measures.length) {
    next.measures = [createMeasureMeta(0)]
    for (const track of next.tracks) {
      track.notes = []
    }
    return { document: next, warnings: [] }
  }
  next.measures = next.measures
    .filter((measure) => measure.index < start || measure.index > end)
    .map((measure, index) => ({ ...measure, index }))
  for (const track of next.tracks) {
    track.notes = track.notes
      .filter((note) => note.measureIndex < start || note.measureIndex > end)
      .map((note) => ({
        ...note,
        measureIndex:
          note.measureIndex > end ? note.measureIndex - deleteCount : note.measureIndex,
      }))
  }
  return { document: next, warnings: [] }
}
