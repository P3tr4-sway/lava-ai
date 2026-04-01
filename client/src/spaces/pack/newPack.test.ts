import { describe, expect, it } from 'vitest'
import { buildNewPackProjectPayload, createConfiguredScoreDocument } from './newPack'

describe('newPack helpers', () => {
  it('creates a configured score document with the requested bars and tuning', () => {
    const document = createConfiguredScoreDocument({
      name: 'Practice Grid',
      bars: 32,
      tempo: 96,
      timeSignature: '6/8',
      key: 'G',
      layout: 'split',
      tuning: 'drop-d',
      capo: 2,
    })

    expect(document.title).toBe('Practice Grid')
    expect(document.measures).toHaveLength(32)
    expect(document.tempo).toBe(96)
    expect(document.meter).toEqual({ numerator: 6, denominator: 8 })
    expect(document.tracks[0]?.tuning).toEqual([64, 59, 55, 50, 45, 38])
    expect(document.tracks[0]?.capo).toBe(2)
  })

  it('builds project metadata with score snapshot, music xml, and sections', () => {
    const payload = buildNewPackProjectPayload({
      name: 'Blank 8 bars',
      bars: 8,
      tempo: 120,
      timeSignature: '4/4',
      key: 'C',
      layout: 'split',
      tuning: 'standard',
      capo: 0,
    })

    expect(payload.name).toBe('Blank 8 bars')
    expect(payload.metadata.scoreView).toBe('split')
    expect(typeof payload.metadata.musicXml).toBe('string')
    expect(payload.metadata.sections).toHaveLength(1)
    expect(payload.metadata.scoreDocument.measures).toHaveLength(8)
  })
})
