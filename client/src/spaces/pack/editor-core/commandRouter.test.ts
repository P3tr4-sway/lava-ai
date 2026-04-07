import { describe, it, expect } from 'vitest'
import { applyCommandToDocument } from './commandRouter'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'

describe('applyCommandToDocument (router)', () => {
  it('dispatches insertNoteAtCaret and returns valid result', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const result = applyCommandToDocument(doc, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 0,
      string: 1,
      fret: 5,
      durationType: 'quarter',
    })
    expect(result.document.tracks[0]!.notes).toHaveLength(1)
  })

  it('runs validation after insertNoteAtCaret — truncates overflow', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id

    // Insert 4 quarter notes (fills 4/4 bar)
    let current = doc
    for (let beat = 0; beat < 4; beat++) {
      const r = applyCommandToDocument(current, {
        type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat, string: 1, fret: 5, durationType: 'quarter',
      })
      current = r.document
    }

    // Insert a half note at beat 3 — should be truncated to quarter
    const r = applyCommandToDocument(current, {
      type: 'insertNoteAtCaret', trackId, measureIndex: 0, beat: 3, string: 2, fret: 7, durationType: 'half',
    })
    const notesAtBeat3 = r.document.tracks[0]!.notes.filter((n) => n.beat === 3)
    // The half note should have been truncated
    for (const n of notesAtBeat3) {
      expect(n.durationDivisions).toBeLessThanOrEqual(doc.divisions) // <= 1 quarter
    }
  })

  it('returns warnings for unknown command type', () => {
    const doc = createEmptyScoreDocument()
    const result = applyCommandToDocument(doc, { type: 'nonExistent' } as any)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
