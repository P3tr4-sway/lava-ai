import { describe, it, expect } from 'vitest'
import { handleAddTechnique, handleRemoveTechnique } from './techniques'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'
import { handleInsertNoteAtCaret } from './noteEntry'
import type { Technique } from '@lava/shared'

function docWithNote() {
  const doc = createEmptyScoreDocument()
  const trackId = doc.tracks[0]!.id
  return handleInsertNoteAtCaret(doc, {
    type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 0, string: 1, fret: 5, durationType: 'quarter',
  })
}

describe('handleAddTechnique', () => {
  it('adds a parameterized bend technique', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const technique: Technique = { type: 'bend', style: 'full', semitones: 2 }
    const result = handleAddTechnique(document, { type: 'addTechnique', noteId, technique })
    const note = result.document.tracks[0]!.notes[0]!
    expect(note.techniques).toHaveLength(1)
    expect(note.techniques[0]).toEqual({ type: 'bend', style: 'full', semitones: 2 })
  })

  it('replaces existing technique of same type', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleAddTechnique(document, { type: 'addTechnique', noteId, technique: { type: 'bend', style: 'full', semitones: 1 } })
    const r2 = handleAddTechnique(r1.document, { type: 'addTechnique', noteId, technique: { type: 'bend', style: 'half', semitones: 0.5 } })
    const note = r2.document.tracks[0]!.notes[0]!
    expect(note.techniques).toHaveLength(1)
    expect(note.techniques[0]).toEqual({ type: 'bend', style: 'half', semitones: 0.5 })
  })

  it('adds a no-param technique', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const result = handleAddTechnique(document, { type: 'addTechnique', noteId, technique: { type: 'palmMute' } })
    expect(result.document.tracks[0]!.notes[0]!.techniques[0]).toEqual({ type: 'palmMute' })
  })
})

describe('handleRemoveTechnique', () => {
  it('removes a technique by type', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleAddTechnique(document, { type: 'addTechnique', noteId, technique: { type: 'palmMute' } })
    const r2 = handleRemoveTechnique(r1.document, { type: 'removeTechnique', noteId, techniqueType: 'palmMute' })
    expect(r2.document.tracks[0]!.notes[0]!.techniques).toHaveLength(0)
  })

  it('leaves other techniques intact', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleAddTechnique(document, { type: 'addTechnique', noteId, technique: { type: 'palmMute' } })
    const r2 = handleAddTechnique(r1.document, { type: 'addTechnique', noteId, technique: { type: 'hammerOn' } })
    const r3 = handleRemoveTechnique(r2.document, { type: 'removeTechnique', noteId, techniqueType: 'palmMute' })
    const note = r3.document.tracks[0]!.notes[0]!
    expect(note.techniques).toHaveLength(1)
    expect(note.techniques[0]).toEqual({ type: 'hammerOn' })
  })
})
