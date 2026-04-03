import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { cloneDocument } from '../helpers'

export function handleSetLyric(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setLyric' }>,
): CommandResult {
  const next = cloneDocument(doc)
  for (const track of next.tracks) {
    const note = track.notes.find((n) => n.id === cmd.noteId)
    if (note) {
      note.lyric = cmd.text || undefined
      break
    }
  }
  return { document: next, warnings: [] }
}
