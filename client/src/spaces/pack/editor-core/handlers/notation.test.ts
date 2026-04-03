import { describe, it, expect } from 'vitest'
import { handleToggleDot, handleToggleTuplet, handleToggleTie, handleToggleSlur } from './notation'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'
import { handleInsertNoteAtCaret } from './noteEntry'

function docWithNote() {
  const doc = createEmptyScoreDocument()
  const trackId = doc.tracks[0]!.id
  return handleInsertNoteAtCaret(doc, {
    type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 0, string: 1, fret: 5, durationType: 'quarter',
  })
}

describe('handleToggleDot', () => {
  it('cycles dots 0 → 1 → 2 → 0', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id

    const r1 = handleToggleDot(document, { type: 'toggleDot', noteId })
    expect(r1.document.tracks[0]!.notes[0]!.dots).toBe(1)

    const r2 = handleToggleDot(r1.document, { type: 'toggleDot', noteId })
    expect(r2.document.tracks[0]!.notes[0]!.dots).toBe(2)

    const r3 = handleToggleDot(r2.document, { type: 'toggleDot', noteId })
    expect(r3.document.tracks[0]!.notes[0]!.dots).toBe(0)
  })
})

describe('handleToggleTuplet', () => {
  it('adds triplet when not present', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const result = handleToggleTuplet(document, { type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
    expect(result.document.tracks[0]!.notes[0]!.tuplet).toEqual({ actual: 3, normal: 2 })
  })

  it('removes tuplet when same ratio already present', () => {
    const { document } = docWithNote()
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleToggleTuplet(document, { type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
    const r2 = handleToggleTuplet(r1.document, { type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
    expect(r2.document.tracks[0]!.notes[0]!.tuplet).toBeUndefined()
  })
})

describe('handleToggleTie', () => {
  it('toggles tieStart on the note', () => {
    const { document } = docWithNote()
    const trackId = document.tracks[0]!.id
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleToggleTie(document, { type: 'toggleTie', trackId, noteId })
    expect(r1.document.tracks[0]!.notes[0]!.tieStart).toBe(true)
    const r2 = handleToggleTie(r1.document, { type: 'toggleTie', trackId, noteId })
    expect(r2.document.tracks[0]!.notes[0]!.tieStart).toBe(false)
  })
})

describe('handleToggleSlur', () => {
  it('toggles slurStart on the note', () => {
    const { document } = docWithNote()
    const trackId = document.tracks[0]!.id
    const noteId = document.tracks[0]!.notes[0]!.id
    const r1 = handleToggleSlur(document, { type: 'toggleSlur', trackId, noteId })
    expect(r1.document.tracks[0]!.notes[0]!.slurStart).toBe(true)
    const r2 = handleToggleSlur(r1.document, { type: 'toggleSlur', trackId, noteId })
    expect(r2.document.tracks[0]!.notes[0]!.slurStart).toBe(false)
  })
})
