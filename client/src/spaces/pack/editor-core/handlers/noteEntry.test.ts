import { describe, it, expect } from 'vitest'
import { handleInsertNoteAtCaret, handleInsertRestAtCaret, handleDeleteNote } from './noteEntry'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'

describe('handleInsertNoteAtCaret', () => {
  it('inserts a note at the specified position', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const result = handleInsertNoteAtCaret(doc, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      string: 1,
      fret: 5,
      durationType: 'quarter',
    })
    const track = result.document.tracks[0]!
    expect(track.notes).toHaveLength(1)
    expect(track.notes[0]!.placement?.fret).toBe(5)
    expect(track.notes[0]!.durationType).toBe('quarter')
    expect(track.notes[0]!.techniques).toEqual([])
  })

  it('uses Technique[] not TechniqueSet for new notes', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const result = handleInsertNoteAtCaret(doc, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      string: 1,
      fret: 0,
      durationType: 'quarter',
    })
    const note = result.document.tracks[0]!.notes[0]!
    expect(Array.isArray(note.techniques)).toBe(true)
  })
})

describe('handleInsertRestAtCaret', () => {
  it('inserts a rest', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const result = handleInsertRestAtCaret(doc, {
      type: 'insertRestAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      durationType: 'quarter',
    })
    const note = result.document.tracks[0]!.notes[0]!
    expect(note.isRest).toBe(true)
    expect(note.techniques).toEqual([])
  })
})

describe('handleDeleteNote', () => {
  it('removes the note with matching id', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const afterInsert = handleInsertNoteAtCaret(doc, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      string: 1,
      fret: 5,
      durationType: 'quarter',
    })
    const noteId = afterInsert.document.tracks[0]!.notes[0]!.id
    const result = handleDeleteNote(afterInsert.document, { type: 'deleteNote', noteId, trackId: afterInsert.document.tracks[0]!.id })
    expect(result.document.tracks[0]!.notes).toHaveLength(0)
  })
})
