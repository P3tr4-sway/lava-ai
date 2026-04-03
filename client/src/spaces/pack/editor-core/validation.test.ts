import { describe, it, expect } from 'vitest'
import { computeEffectiveDuration, getMeasureCapacity, validateAndTruncate } from './validation'
import type { ScoreNoteEvent } from '@lava/shared'

const DIVISIONS = 480

function makeNote(overrides: Partial<ScoreNoteEvent>): ScoreNoteEvent {
  return {
    id: 'n1',
    measureIndex: 0,
    voice: 1,
    beat: 0,
    durationDivisions: DIVISIONS,
    durationType: 'quarter',
    dots: 0,
    isRest: false,
    pitch: { step: 'C', octave: 4 },
    placement: null,
    techniques: [],
    ...overrides,
  }
}

describe('computeEffectiveDuration', () => {
  it('returns base duration for plain note', () => {
    expect(computeEffectiveDuration(makeNote({ durationType: 'quarter', dots: 0 }), DIVISIONS)).toBe(480)
  })

  it('adds 50% for single dot', () => {
    expect(computeEffectiveDuration(makeNote({ durationType: 'quarter', dots: 1 }), DIVISIONS)).toBe(720)
  })

  it('adds 75% for double dot', () => {
    expect(computeEffectiveDuration(makeNote({ durationType: 'quarter', dots: 2 }), DIVISIONS)).toBe(840)
  })

  it('applies tuplet ratio', () => {
    const note = makeNote({ durationType: 'quarter', dots: 0, tuplet: { actual: 3, normal: 2 } })
    expect(computeEffectiveDuration(note, DIVISIONS)).toBe(320)
  })

  it('applies both dot and tuplet', () => {
    const note = makeNote({ durationType: 'quarter', dots: 1, tuplet: { actual: 3, normal: 2 } })
    expect(computeEffectiveDuration(note, DIVISIONS)).toBe(480) // 720 * 2/3
  })
})

describe('getMeasureCapacity', () => {
  it('returns 4 quarters for 4/4', () => {
    expect(getMeasureCapacity({ numerator: 4, denominator: 4 }, DIVISIONS)).toBe(1920)
  })

  it('returns 3 quarters for 3/4', () => {
    expect(getMeasureCapacity({ numerator: 3, denominator: 4 }, DIVISIONS)).toBe(1440)
  })

  it('returns 3 quarters for 6/8', () => {
    expect(getMeasureCapacity({ numerator: 6, denominator: 8 }, DIVISIONS)).toBe(1440)
  })
})

describe('validateAndTruncate', () => {
  it('truncates a note that overflows the measure', () => {
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0 }),
      makeNote({ id: 'n2', beat: 1 }),
      makeNote({ id: 'n3', beat: 2 }),
      makeNote({ id: 'n4', beat: 3, durationType: 'half', durationDivisions: 960 }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const n4 = result.find((n) => n.id === 'n4')!
    expect(n4.durationDivisions).toBe(DIVISIONS) // truncated to quarter
    expect(n4.durationType).toBe('quarter')
  })

  it('removes notes whose beat start is beyond capacity', () => {
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0 }),
      makeNote({ id: 'n5', beat: 5 }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    expect(result.find((n) => n.id === 'n5')).toBeUndefined()
  })

  it('clears dots when truncating', () => {
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0, durationType: 'half', durationDivisions: 960 }),
      makeNote({ id: 'n2', beat: 2, durationType: 'half', durationDivisions: 960, dots: 1 }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const n2 = result.find((n) => n.id === 'n2')!
    expect(n2.dots).toBe(0)
    expect(n2.durationDivisions).toBe(960) // dotted half overflows → truncated to plain half, dots cleared
  })

  it('clears tuplet when truncating', () => {
    // A dotted quarter triplet at beat 3 overflows 4/4 → truncate to sixteenth, clear tuplet
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0, durationType: 'half', durationDivisions: 960 }),
      makeNote({ id: 'n2', beat: 2, durationType: 'half', durationDivisions: 960 }),
      // tuplet note at beat 3.5 (overflow)
      makeNote({ id: 'n3', beat: 3.5, durationType: 'quarter', durationDivisions: 480, tuplet: { actual: 3, normal: 2 } }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const n3 = result.find((n) => n.id === 'n3')!
    expect(n3.tuplet).toBeUndefined()
  })

  it('leaves valid measures unchanged', () => {
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0 }),
      makeNote({ id: 'n2', beat: 1 }),
      makeNote({ id: 'n3', beat: 2 }),
      makeNote({ id: 'n4', beat: 3 }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    expect(result).toHaveLength(4)
    expect(result.every((n) => n.durationDivisions === DIVISIONS)).toBe(true)
  })
})
