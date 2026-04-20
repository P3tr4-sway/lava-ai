/**
 * SelectionModel unit tests.
 *
 * Uses a minimal ScoreNode fixture: 1 track, 3 bars, 1 voice, 2 beats per bar,
 * 6-string tuning (standard E).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SelectionModel } from '../SelectionModel'
import type { ScoreNode, BarNode, BeatNode, VoiceNode, StaffNode } from '../../ast/types'

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function makeBeat(id: string): BeatNode {
  return {
    id,
    duration: { value: 4, dots: 0 },
    notes: [],
  }
}

function makeVoice(id: string, beatCount: number): VoiceNode {
  return {
    id,
    beats: Array.from({ length: beatCount }, (_, i) => makeBeat(`${id}-beat-${i}`)),
  }
}

function makeBar(id: string, beatCount: number): BarNode {
  return {
    id,
    voices: [makeVoice(`${id}-v0`, beatCount)],
  }
}

function makeStaff(barCount: number, beatsPerBar: number): StaffNode {
  return {
    id: 'staff-0',
    bars: Array.from({ length: barCount }, (_, i) => makeBar(`bar-${i}`, beatsPerBar)),
  }
}

/** Minimal 1-track, 3-bar, 2-beats-per-bar, 6-string ScoreNode */
function makeScore(barCount = 3, beatsPerBar = 2, stringCount = 6): ScoreNode {
  return {
    id: 'score-0',
    meta: { tempo: 120 },
    tracks: [
      {
        id: 'track-0',
        name: 'Guitar',
        instrument: 25,
        tuning: Array.from({ length: stringCount }, (_, i) => 40 + i * 5), // 6 MIDI values
        capo: 0,
        chordDefs: [],
        staves: [makeStaff(barCount, beatsPerBar)],
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SelectionModel', () => {
  let model: SelectionModel
  const score = makeScore() // 3 bars, 2 beats each, 6 strings

  beforeEach(() => {
    model = new SelectionModel()
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts as caret at (0,0,0,0,1)', () => {
    expect(model.selection.kind).toBe('caret')
    const c = model.cursor
    expect(c.trackIndex).toBe(0)
    expect(c.barIndex).toBe(0)
    expect(c.beatIndex).toBe(0)
    expect(c.stringIndex).toBe(1)
  })

  // -------------------------------------------------------------------------
  // moveRight
  // -------------------------------------------------------------------------

  it('moveRight advances beatIndex within the same bar', () => {
    const next = model.moveRight(score)
    expect(next.barIndex).toBe(0)
    expect(next.beatIndex).toBe(1)
  })

  it('moveRight wraps to beat 0 of the next bar', () => {
    // Position at last beat of bar 0
    model.setCursor({ ...model.cursor, barIndex: 0, beatIndex: 1 })
    const next = model.moveRight(score)
    expect(next.barIndex).toBe(1)
    expect(next.beatIndex).toBe(0)
  })

  it('moveRight stays at end when at last beat of last bar', () => {
    model.setCursor({ ...model.cursor, barIndex: 2, beatIndex: 1 })
    const next = model.moveRight(score)
    expect(next.barIndex).toBe(2)
    expect(next.beatIndex).toBe(1)
  })

  // -------------------------------------------------------------------------
  // moveLeft
  // -------------------------------------------------------------------------

  it('moveLeft decrements beatIndex within the same bar', () => {
    model.setCursor({ ...model.cursor, beatIndex: 1 })
    const next = model.moveLeft(score)
    expect(next.barIndex).toBe(0)
    expect(next.beatIndex).toBe(0)
  })

  it('moveLeft wraps to last beat of the previous bar', () => {
    model.setCursor({ ...model.cursor, barIndex: 1, beatIndex: 0 })
    const next = model.moveLeft(score)
    expect(next.barIndex).toBe(0)
    expect(next.beatIndex).toBe(1) // last beat of bar 0 (2 beats → index 1)
  })

  it('moveLeft stays at start when at beat 0 of bar 0', () => {
    const next = model.moveLeft(score)
    expect(next.barIndex).toBe(0)
    expect(next.beatIndex).toBe(0)
  })

  // -------------------------------------------------------------------------
  // moveUp / moveDown
  // -------------------------------------------------------------------------

  it('moveUp decrements stringIndex', () => {
    model.setCursor({ ...model.cursor, stringIndex: 3 })
    const next = model.moveUp()
    expect(next.stringIndex).toBe(2)
  })

  it('moveUp clamps at stringIndex 1', () => {
    model.setCursor({ ...model.cursor, stringIndex: 1 })
    const next = model.moveUp()
    expect(next.stringIndex).toBe(1)
  })

  it('moveDown increments stringIndex', () => {
    model.setCursor({ ...model.cursor, stringIndex: 4 })
    const next = model.moveDown(score)
    expect(next.stringIndex).toBe(5)
  })

  it('moveDown clamps at max string count', () => {
    model.setCursor({ ...model.cursor, stringIndex: 6 })
    const next = model.moveDown(score) // score has 6 strings
    expect(next.stringIndex).toBe(6)
  })

  // -------------------------------------------------------------------------
  // setFromHitPosition
  // -------------------------------------------------------------------------

  it('setFromHitPosition updates cursor and collapses to caret', () => {
    model.setFromHitPosition({
      trackIndex: 0,
      barIndex: 2,
      voiceIndex: 0,
      beatIndex: 1,
      stringIndex: 4,
    })

    expect(model.selection.kind).toBe('caret')
    const c = model.cursor
    expect(c.barIndex).toBe(2)
    expect(c.beatIndex).toBe(1)
    expect(c.stringIndex).toBe(4)
  })

  // -------------------------------------------------------------------------
  // selectToRight
  // -------------------------------------------------------------------------

  it('selectToRight creates a range selection', () => {
    // Start at bar 0, beat 0
    model.selectToRight(score)

    expect(model.selection.kind).toBe('range')
    const s = model.selection as { kind: 'range'; anchor: import('../SelectionModel').Cursor; focus: import('../SelectionModel').Cursor }
    expect(s.anchor.beatIndex).toBe(0) // anchor stays
    expect(s.focus.beatIndex).toBe(1)  // focus advances
  })

  it('selectToRight extends an existing range selection', () => {
    // First extension: beat 0 → beat 1
    model.selectToRight(score)
    // Second extension: should now move focus to bar 1, beat 0
    // (since bar 0 has only 2 beats and focus is now at beat 1 = last)
    model.selectToRight(score)

    expect(model.selection.kind).toBe('range')
    const s = model.selection as { kind: 'range'; anchor: import('../SelectionModel').Cursor; focus: import('../SelectionModel').Cursor }
    expect(s.anchor.barIndex).toBe(0)
    expect(s.anchor.beatIndex).toBe(0)
    expect(s.focus.barIndex).toBe(1)
    expect(s.focus.beatIndex).toBe(0)
  })

  // -------------------------------------------------------------------------
  // clearToCaret
  // -------------------------------------------------------------------------

  it('clearToCaret collapses range to caret', () => {
    model.selectToRight(score)
    expect(model.selection.kind).toBe('range')

    model.clearToCaret()
    expect(model.selection.kind).toBe('caret')
    // Caret should be at the focus position (beat 1 after one selectToRight)
    expect(model.cursor.beatIndex).toBe(1)
  })

  // -------------------------------------------------------------------------
  // setCursor
  // -------------------------------------------------------------------------

  it('setCursor collapses to caret at specified position', () => {
    model.selectToRight(score) // make it a range first
    model.setCursor({ trackIndex: 0, barIndex: 2, voiceIndex: 0, beatIndex: 0, stringIndex: 2 })
    expect(model.selection.kind).toBe('caret')
    expect(model.cursor.barIndex).toBe(2)
    expect(model.cursor.stringIndex).toBe(2)
  })

  // -------------------------------------------------------------------------
  // constructor with initial partial cursor
  // -------------------------------------------------------------------------

  it('accepts partial cursor in constructor', () => {
    const m = new SelectionModel({ barIndex: 1, stringIndex: 3 })
    expect(m.cursor.barIndex).toBe(1)
    expect(m.cursor.stringIndex).toBe(3)
    expect(m.cursor.beatIndex).toBe(0)
  })

  // -------------------------------------------------------------------------
  // moveToNextBar / moveToPrevBar
  // -------------------------------------------------------------------------

  it('moveToNextBar jumps to next bar at beat 0', () => {
    model.setCursor({ ...model.cursor, barIndex: 1, beatIndex: 1 })
    const next = model.moveToNextBar(score)
    expect(next.barIndex).toBe(2)
    expect(next.beatIndex).toBe(0)
  })

  it('moveToNextBar stays at last bar', () => {
    model.setCursor({ ...model.cursor, barIndex: 2 })
    const next = model.moveToNextBar(score)
    expect(next.barIndex).toBe(2)
  })

  it('moveToPrevBar jumps to previous bar at beat 0', () => {
    model.setCursor({ ...model.cursor, barIndex: 2, beatIndex: 1 })
    const next = model.moveToPrevBar()
    expect(next.barIndex).toBe(1)
    expect(next.beatIndex).toBe(0)
  })

  it('moveToPrevBar stays at bar 0', () => {
    const next = model.moveToPrevBar()
    expect(next.barIndex).toBe(0)
  })

  // -------------------------------------------------------------------------
  // moveToStart / moveToEnd
  // -------------------------------------------------------------------------

  it('moveToStart jumps to bar 0 beat 0', () => {
    model.setCursor({ ...model.cursor, barIndex: 2, beatIndex: 1 })
    const next = model.moveToStart()
    expect(next.barIndex).toBe(0)
    expect(next.beatIndex).toBe(0)
  })

  it('moveToEnd jumps to last beat of last bar', () => {
    const next = model.moveToEnd(score)
    expect(next.barIndex).toBe(2)
    expect(next.beatIndex).toBe(1) // 2 beats → last index is 1
  })

  // -------------------------------------------------------------------------
  // setNote — Sibelius-style notehead selection
  // -------------------------------------------------------------------------

  it('setNote produces a kind="note" selection at the given cursor', () => {
    model.setNote({
      trackIndex: 0,
      barIndex: 1,
      voiceIndex: 0,
      beatIndex: 1,
      stringIndex: 3,
    })

    expect(model.selection.kind).toBe('note')
    const c = model.cursor
    expect(c.barIndex).toBe(1)
    expect(c.beatIndex).toBe(1)
    expect(c.stringIndex).toBe(3)
  })

  it('setNote followed by setCursor collapses note → caret', () => {
    model.setNote({
      trackIndex: 0,
      barIndex: 0,
      voiceIndex: 0,
      beatIndex: 1,
      stringIndex: 2,
    })
    expect(model.selection.kind).toBe('note')

    model.setCursor(model.cursor)
    expect(model.selection.kind).toBe('caret')
    expect(model.cursor.beatIndex).toBe(1)
    expect(model.cursor.stringIndex).toBe(2)
  })

  it('cursor getter returns the note cursor when kind="note"', () => {
    model.setNote({
      trackIndex: 0,
      barIndex: 2,
      voiceIndex: 0,
      beatIndex: 0,
      stringIndex: 4,
      stringLineY: 42,
    })

    const c = model.cursor
    expect(c.barIndex).toBe(2)
    expect(c.stringIndex).toBe(4)
    expect(c.stringLineY).toBe(42)
  })
})
