import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { createId } from '../helpers'

function cloneDocument(doc: ScoreDocument): ScoreDocument {
  return structuredClone(doc)
}

export function handlePasteSelection(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'pasteSelection' }>,
): CommandResult {
  const next = cloneDocument(doc) as ScoreDocument
  const track = next.tracks.find((t) => t.id === cmd.targetTrackId)
  if (!track) return { document: next, warnings: ['Track not found'] }

  const { clipboard } = cmd

  // Ensure enough measures exist
  const neededMeasures = cmd.targetMeasureIndex + clipboard.sourceMeasureCount
  while (next.measures.length < neededMeasures) {
    const idx = next.measures.length
    next.measures.push({
      id: createId(`measure-${idx}`),
      index: idx,
      harmony: [],
      annotations: [],
    })
  }

  // Insert notes with offset
  for (const clipNote of clipboard.notes) {
    const newNote = {
      ...clipNote,
      id: createId('note'),
      measureIndex: cmd.targetMeasureIndex + clipNote.measureIndex,
      beat:
        clipNote.measureIndex === 0
          ? cmd.targetBeat + clipNote.beat
          : clipNote.beat,
      techniques: clipNote.techniques.map((t) => ({ ...t })),
    }
    track.notes.push(newNote)
  }

  // Copy measure metadata
  for (const clipMeta of clipboard.measures) {
    const targetIdx = cmd.targetMeasureIndex + clipMeta.index
    const targetMeta = next.measures[targetIdx]
    if (targetMeta) {
      targetMeta.harmony = [...clipMeta.harmony]
      targetMeta.annotations = [...clipMeta.annotations]
    }
  }

  // Sort notes
  track.notes.sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)

  return { document: next, warnings: [] }
}
