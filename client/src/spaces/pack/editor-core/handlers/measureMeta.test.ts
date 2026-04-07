import { describe, it, expect } from 'vitest'
import { handleSetMeasureTimeSignature, handleSetMeasureKeySignature } from './measureMeta'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'

describe('handleSetMeasureTimeSignature', () => {
  it('sets time signature on a specific measure without affecting global', () => {
    const doc = createEmptyScoreDocument()
    const result = handleSetMeasureTimeSignature(doc, {
      type: 'setMeasureTimeSignature',
      measureIndex: 0,
      timeSignature: { numerator: 3, denominator: 4 },
    })
    expect(result.document.measures[0]!.timeSignature).toEqual({ numerator: 3, denominator: 4 })
    expect(result.document.meter).toEqual(doc.meter) // global unchanged
  })
})

describe('handleSetMeasureKeySignature', () => {
  it('sets key signature on a specific measure without affecting global', () => {
    const doc = createEmptyScoreDocument()
    const result = handleSetMeasureKeySignature(doc, {
      type: 'setMeasureKeySignature',
      measureIndex: 0,
      keySignature: { key: 'G', mode: 'major' },
    })
    expect(result.document.measures[0]!.keySignature).toEqual({ key: 'G', mode: 'major' })
    expect(result.document.keySignature).toEqual(doc.keySignature)
  })
})
