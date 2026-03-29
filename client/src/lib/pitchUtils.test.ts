import { describe, it, expect } from 'vitest'
import {
  pitchToMidi,
  midiToPitch,
  stepDiatonic,
  midiToFret,
  fretToMidi,
  STANDARD_TUNING,
} from './pitchUtils'

describe('pitchToMidi', () => {
  it('converts C4 to 60', () => {
    expect(pitchToMidi({ step: 'C', octave: 4 })).toBe(60)
  })
  it('converts A4 to 69', () => {
    expect(pitchToMidi({ step: 'A', octave: 4 })).toBe(69)
  })
  it('handles sharps', () => {
    expect(pitchToMidi({ step: 'F', octave: 4, alter: 1 })).toBe(66)
  })
  it('handles flats', () => {
    expect(pitchToMidi({ step: 'B', octave: 3, alter: -1 })).toBe(58)
  })
})

describe('midiToPitch', () => {
  it('converts 60 to C4', () => {
    expect(midiToPitch(60)).toEqual({ step: 'C', octave: 4, alter: 0 })
  })
  it('converts 61 to C#4', () => {
    expect(midiToPitch(61)).toEqual({ step: 'C', octave: 4, alter: 1 })
  })
  it('returns flat spelling when preferFlats=true', () => {
    expect(midiToPitch(61, true)).toEqual({ step: 'D', octave: 4, alter: -1 })
  })
  it('returns sharp spelling by default', () => {
    expect(midiToPitch(61)).toEqual({ step: 'C', octave: 4, alter: 1 })
  })
})

describe('stepDiatonic', () => {
  it('steps up from C4', () => {
    expect(stepDiatonic({ step: 'C', octave: 4 }, 1)).toEqual({ step: 'D', octave: 4, alter: 0 })
  })
  it('wraps from B to next octave', () => {
    expect(stepDiatonic({ step: 'B', octave: 4 }, 1)).toEqual({ step: 'C', octave: 5, alter: 0 })
  })
  it('steps down from C to previous octave', () => {
    expect(stepDiatonic({ step: 'C', octave: 4 }, -1)).toEqual({ step: 'B', octave: 3, alter: 0 })
  })
  it('jumps octave up', () => {
    expect(stepDiatonic({ step: 'E', octave: 3 }, 7)).toEqual({ step: 'E', octave: 4, alter: 0 })
  })
})

describe('midiToFret', () => {
  it('finds E2 on open 6th string', () => {
    const result = midiToFret(40, STANDARD_TUNING)
    expect(result).toContainEqual({ string: 6, fret: 0 })
  })
  it('finds A4 on multiple strings', () => {
    const result = midiToFret(69, STANDARD_TUNING)
    expect(result.length).toBeGreaterThan(0)
    result.forEach((r) => {
      expect(r.fret).toBeGreaterThanOrEqual(0)
      expect(r.fret).toBeLessThanOrEqual(12)
    })
  })
})

describe('fretToMidi', () => {
  it('converts 6th string open to E2 (40)', () => {
    expect(fretToMidi(6, 0, STANDARD_TUNING)).toBe(40)
  })
  it('converts 1st string 5th fret to A4 (69)', () => {
    expect(fretToMidi(1, 5, STANDARD_TUNING)).toBe(69)
  })
  it('throws RangeError for invalid string number', () => {
    expect(() => fretToMidi(0, 0, STANDARD_TUNING)).toThrow(RangeError)
    expect(() => fretToMidi(7, 0, STANDARD_TUNING)).toThrow(RangeError)
  })
})
