import { describe, it, expect } from 'vitest'
import { handlePasteSelection } from './clipboard'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'
import type { ScoreClipboard } from '@lava/shared'

describe('handlePasteSelection', () => {
  it('inserts clipboard notes at target position', () => {
    const doc = createEmptyScoreDocument()
    const trackId = doc.tracks[0]!.id
    const clipboard: ScoreClipboard = {
      notes: [{
        id: 'clip-n1',
        measureIndex: 0,
        voice: 1,
        beat: 0,
        durationDivisions: 480,
        durationType: 'quarter',
        dots: 0,
        isRest: false,
        pitch: { step: 'C', octave: 4 },
        placement: null,
        techniques: [],
      }],
      measures: [],
      sourceMeasureCount: 1,
    }
    const result = handlePasteSelection(doc, {
      type: 'pasteSelection',
      targetTrackId: trackId,
      targetMeasureIndex: 0,
      targetBeat: 2,
      clipboard,
    })
    const note = result.document.tracks[0]!.notes[0]!
    expect(note.measureIndex).toBe(0)
    expect(note.beat).toBe(2) // targetBeat + clipNote.beat(0)
    expect(note.id).not.toBe('clip-n1') // new id assigned
  })

  it('returns a warning when track is not found', () => {
    const doc = createEmptyScoreDocument()
    const clipboard: ScoreClipboard = { notes: [], measures: [], sourceMeasureCount: 1 }
    const result = handlePasteSelection(doc, {
      type: 'pasteSelection',
      targetTrackId: 'nonexistent-track',
      targetMeasureIndex: 0,
      targetBeat: 0,
      clipboard,
    })
    expect(result.warnings).toContain('Track not found')
  })
})
