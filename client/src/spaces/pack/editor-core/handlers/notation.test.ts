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
  it('refuses to tie when there is no next note in the voice', () => {
    const { document } = docWithNote()
    const trackId = document.tracks[0]!.id
    const noteId = document.tracks[0]!.notes[0]!.id
    const r = handleToggleTie(document, { type: 'toggleTie', trackId, noteId })
    expect(r.document.tracks[0]!.notes[0]!.tieStart).toBeFalsy()
    expect(r.warnings.length).toBe(1)
  })

  it('ties two adjacent same-pitch notes and sets tieStop on the second', () => {
    const { document: d1 } = docWithNote()
    const trackId = d1.tracks[0]!.id
    // Insert second same-pitch note at beat 1
    const d2 = handleInsertNoteAtCaret(d1, {
      type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 1, string: 1, fret: 5, durationType: 'quarter',
    }).document
    const firstId = d2.tracks[0]!.notes[0]!.id
    const r = handleToggleTie(d2, { type: 'toggleTie', trackId, noteId: firstId })
    expect(r.warnings).toEqual([])
    const notes = r.document.tracks[0]!.notes
    expect(notes[0]!.tieStart).toBe(true)
    expect(notes[1]!.tieStop).toBe(true)
  })

  it('refuses to tie when the next note has a different pitch', () => {
    const { document: d1 } = docWithNote()
    const trackId = d1.tracks[0]!.id
    const d2 = handleInsertNoteAtCaret(d1, {
      // Different fret on same string → different pitch
      type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 1, string: 1, fret: 7, durationType: 'quarter',
    }).document
    const firstId = d2.tracks[0]!.notes[0]!.id
    const r = handleToggleTie(d2, { type: 'toggleTie', trackId, noteId: firstId })
    expect(r.warnings.length).toBe(1)
    expect(r.document.tracks[0]!.notes[0]!.tieStart).toBeFalsy()
  })

  it('turning a tie off succeeds even with no matching next note', () => {
    const { document: d1 } = docWithNote()
    const trackId = d1.tracks[0]!.id
    const noteId = d1.tracks[0]!.notes[0]!.id
    // Seed tieStart=true manually (simulating stale data)
    d1.tracks[0]!.notes[0]!.tieStart = true
    const r = handleToggleTie(d1, { type: 'toggleTie', trackId, noteId })
    expect(r.warnings).toEqual([])
    expect(r.document.tracks[0]!.notes[0]!.tieStart).toBe(false)
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
