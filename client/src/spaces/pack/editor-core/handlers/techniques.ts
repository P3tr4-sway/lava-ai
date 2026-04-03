import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'

function cloneDocument(doc: ScoreDocument): ScoreDocument {
  return structuredClone(doc)
}

export function handleAddTechnique(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'addTechnique' }>,
): CommandResult {
  const next = cloneDocument(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      // Remove any existing technique of the same type, then push new one
      note.techniques = [
        ...note.techniques.filter((t) => t.type !== cmd.technique.type),
        cmd.technique,
      ]
      break
    }
  }
  return { document: next, warnings: [] }
}

export function handleRemoveTechnique(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'removeTechnique' }>,
): CommandResult {
  const next = cloneDocument(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      note.techniques = note.techniques.filter((t) => t.type !== cmd.techniqueType)
      break
    }
  }
  return { document: next, warnings: [] }
}
