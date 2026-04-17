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

  it('truncates a prior note whose duration overlaps the next note within the same voice', () => {
    // beat 0: half (0..2), beat 1: quarter (1..2) → half must shrink to quarter
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0, durationType: 'half', durationDivisions: 960 }),
      makeNote({ id: 'n2', beat: 1, durationType: 'quarter', durationDivisions: DIVISIONS }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const n1 = result.find((n) => n.id === 'n1')!
    expect(n1.durationType).toBe('quarter')
    expect(n1.durationDivisions).toBe(DIVISIONS)
    expect(n1.dots).toBe(0)
    // n2 is unchanged
    const n2 = result.find((n) => n.id === 'n2')!
    expect(n2.durationDivisions).toBe(DIVISIONS)
  })

  it('keeps an eighth-on-quarter overwrite at its smaller duration (implicit rest fills gap)', () => {
    // User overwrote beat 0's quarter with an eighth; beat 1 is still a quarter.
    // The eighth should NOT get stretched to fill the gap.
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'n1', beat: 0, durationType: 'eighth', durationDivisions: DIVISIONS / 2 }),
      makeNote({ id: 'n2', beat: 1, durationType: 'quarter', durationDivisions: DIVISIONS }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const n1 = result.find((n) => n.id === 'n1')!
    expect(n1.durationType).toBe('eighth')
    expect(n1.durationDivisions).toBe(DIVISIONS / 2)
  })

  it('treats chord tones sharing a beat as one group (same start bound by next group)', () => {
    // Two notes at beat 0 on different strings form a chord; next note at beat 1.
    // Each chord tone is independently capped at (next.start - chord.start) = 1 quarter.
    const notes: ScoreNoteEvent[] = [
      makeNote({
        id: 'n1-chord-a',
        beat: 0,
        durationType: 'half',
        durationDivisions: 960,
        placement: { string: 1, fret: 5, confidence: 'explicit' },
      }),
      makeNote({
        id: 'n1-chord-b',
        beat: 0,
        durationType: 'half',
        durationDivisions: 960,
        placement: { string: 2, fret: 5, confidence: 'explicit' },
      }),
      makeNote({ id: 'n2', beat: 1, durationType: 'quarter', durationDivisions: DIVISIONS }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    const chordA = result.find((n) => n.id === 'n1-chord-a')!
    const chordB = result.find((n) => n.id === 'n1-chord-b')!
    expect(chordA.durationType).toBe('quarter')
    expect(chordB.durationType).toBe('quarter')
  })

  it('does not treat different voices as overlapping each other', () => {
    // Voice 1 has a whole note; voice 2 has four quarters in the same bar.
    // Neither should truncate the other.
    const notes: ScoreNoteEvent[] = [
      makeNote({ id: 'v1', voice: 1, beat: 0, durationType: 'whole', durationDivisions: 1920 }),
      makeNote({ id: 'v2a', voice: 2, beat: 0 }),
      makeNote({ id: 'v2b', voice: 2, beat: 1 }),
      makeNote({ id: 'v2c', voice: 2, beat: 2 }),
      makeNote({ id: 'v2d', voice: 2, beat: 3 }),
    ]
    const result = validateAndTruncate(notes, 0, { numerator: 4, denominator: 4 }, DIVISIONS)
    expect(result.find((n) => n.id === 'v1')!.durationType).toBe('whole')
    expect(result.filter((n) => n.voice === 2)).toHaveLength(4)
  })
})
