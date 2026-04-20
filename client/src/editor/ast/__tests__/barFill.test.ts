import { describe, expect, it } from 'vitest'
import {
  UNITS_PER_WHOLE,
  barCapacityUnits,
  durationToUnits,
  splitIntoRests,
} from '../barFill'

describe('durationToUnits — base resolution', () => {
  it('whole = 192, quarter = 48, eighth = 24', () => {
    expect(durationToUnits({ value: 1, dots: 0 })).toBe(UNITS_PER_WHOLE)
    expect(durationToUnits({ value: 2, dots: 0 })).toBe(96)
    expect(durationToUnits({ value: 4, dots: 0 })).toBe(48)
    expect(durationToUnits({ value: 8, dots: 0 })).toBe(24)
    expect(durationToUnits({ value: 16, dots: 0 })).toBe(12)
    expect(durationToUnits({ value: 32, dots: 0 })).toBe(6)
    expect(durationToUnits({ value: 64, dots: 0 })).toBe(3)
  })

  it('dots apply standard 3/2 and 7/4 scaling', () => {
    expect(durationToUnits({ value: 4, dots: 1 })).toBe(72)  // dotted quarter
    expect(durationToUnits({ value: 4, dots: 2 })).toBe(84)  // doubly-dotted quarter
  })
})

describe('durationToUnits — tuplet factor', () => {
  it('triplet eighth = 16 ticks (3 fit in one quarter slot)', () => {
    const te = durationToUnits({ value: 8, dots: 0, tuplet: { numerator: 3, denominator: 2 } })
    expect(te).toBe(16)
    expect(3 * te).toBe(durationToUnits({ value: 4, dots: 0 }))
  })

  it('triplet quarter = 32 ticks (3 fit in one half slot)', () => {
    const tq = durationToUnits({ value: 4, dots: 0, tuplet: { numerator: 3, denominator: 2 } })
    expect(tq).toBe(32)
    expect(3 * tq).toBe(durationToUnits({ value: 2, dots: 0 }))
  })

  it('5-against-4 quintuplet on 16ths rounds predictably', () => {
    const q = durationToUnits({ value: 16, dots: 0, tuplet: { numerator: 5, denominator: 4 } })
    expect(q).toBe(Math.floor((12 * 4) / 5)) // 9
  })
})

describe('barCapacityUnits', () => {
  it('4/4 = whole note', () => {
    expect(barCapacityUnits({ numerator: 4, denominator: 4 })).toBe(UNITS_PER_WHOLE)
  })
  it('6/8 = dotted half', () => {
    expect(barCapacityUnits({ numerator: 6, denominator: 8 })).toBe(144)
  })
  it('3/4 fits [triplet-8 × 3] + qtr + qtr exactly', () => {
    const cap = barCapacityUnits({ numerator: 3, denominator: 4 })
    const te = durationToUnits({ value: 8, dots: 0, tuplet: { numerator: 3, denominator: 2 } })
    const q = durationToUnits({ value: 4, dots: 0 })
    // triplet-8 × 3 fills one quarter slot (48 ticks), plus two more quarters.
    expect(te * 3 + q + q).toBe(cap)
  })
})

describe('splitIntoRests', () => {
  it('fills a half-note gap with a half rest', () => {
    const rests = splitIntoRests(48, 96)
    expect(rests).toEqual([2])
  })

  it('fills a dotted-quarter gap with [8th, quarter] (small → large)', () => {
    const rests = splitIntoRests(12, 72)
    expect(rests).toEqual([8, 4])
  })

  it('fills a 4/4 bar from scratch with a whole rest', () => {
    const rests = splitIntoRests(UNITS_PER_WHOLE, UNITS_PER_WHOLE)
    expect(rests).toEqual([1])
  })

  it('empty input yields no rests', () => {
    expect(splitIntoRests(48, 0)).toEqual([])
  })
})
