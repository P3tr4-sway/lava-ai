/**
 * SelectionModel — pure TypeScript cursor / selection for the tab editor.
 *
 * No React, no Zustand, no side effects.
 * All navigation methods return a new Cursor (immutable).
 */

import type { ScoreNode } from '../ast/types'

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

export interface Cursor {
  trackIndex: number
  barIndex: number
  voiceIndex: number
  beatIndex: number
  /** 1-indexed (1 = lowest / thickest string) */
  stringIndex: number
  /** Y coordinate of the resolved string line in alphaTab coordinate space */
  stringLineY?: number
}

export interface BarSpan {
  trackIndex: number
  barIndex: number
}

const DEFAULT_CURSOR: Cursor = {
  trackIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex: 0,
  stringIndex: 1,
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export type Selection =
  | { kind: 'caret'; cursor: Cursor }
  | { kind: 'note'; cursor: Cursor }
  | { kind: 'range'; anchor: Cursor; focus: Cursor }
  | { kind: 'bar'; from: BarSpan; to: BarSpan }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneWith(base: Cursor, patch: Partial<Cursor>): Cursor {
  return { ...base, ...patch }
}

/** Total number of bars for the given track index in the score. */
function barCount(score: ScoreNode, trackIndex: number): number {
  const track = score.tracks[trackIndex]
  if (!track) return 0
  return track.staves[0]?.bars.length ?? 0
}

/** Number of beats in a specific bar / voice. Returns 0 when not found. */
function beatCount(
  score: ScoreNode,
  trackIndex: number,
  barIndex: number,
  voiceIndex: number,
): number {
  const track = score.tracks[trackIndex]
  if (!track) return 0
  const bar = track.staves[0]?.bars[barIndex]
  if (!bar) return 0
  return bar.voices[voiceIndex]?.beats.length ?? 0
}

/** Number of strings for the given track. Falls back to 6. */
function stringCount(score: ScoreNode, trackIndex: number): number {
  return score.tracks[trackIndex]?.tuning.length ?? 6
}

/** Last beat index in a bar (beatCount - 1, or 0 if empty). */
function lastBeatIndex(
  score: ScoreNode,
  trackIndex: number,
  barIndex: number,
  voiceIndex: number,
): number {
  const count = beatCount(score, trackIndex, barIndex, voiceIndex)
  return Math.max(0, count - 1)
}

// ---------------------------------------------------------------------------
// SelectionModel
// ---------------------------------------------------------------------------

export class SelectionModel {
  private _selection: Selection

  constructor(initial?: Partial<Cursor>) {
    const cursor: Cursor = { ...DEFAULT_CURSOR, ...initial }
    this._selection = { kind: 'caret', cursor }
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  get selection(): Selection {
    return this._selection
  }

  /** Returns the active cursor position (focus for range, cursor for caret/note). */
  get cursor(): Cursor {
    if (this._selection.kind === 'caret') {
      return this._selection.cursor
    }
    if (this._selection.kind === 'note') {
      return this._selection.cursor
    }
    if (this._selection.kind === 'range') {
      return this._selection.focus
    }
    // 'bar' kind — return a synthetic cursor at the `from` bar
    return { ...DEFAULT_CURSOR, trackIndex: this._selection.from.trackIndex, barIndex: this._selection.from.barIndex }
  }

  // ---------------------------------------------------------------------------
  // Navigation — all return a new Cursor, do NOT mutate this._selection
  // ---------------------------------------------------------------------------

  /**
   * Move one beat to the left.
   * If at beat 0 of bar 0: stays.
   * If at beat 0 of bar N>0: wraps to last beat of bar N-1.
   */
  moveLeft(score: ScoreNode): Cursor {
    const c = this.cursor
    if (c.beatIndex > 0) {
      return cloneWith(c, { beatIndex: c.beatIndex - 1 })
    }
    if (c.barIndex === 0) {
      return c // already at the very start
    }
    const prevBar = c.barIndex - 1
    const lastBeat = lastBeatIndex(score, c.trackIndex, prevBar, c.voiceIndex)
    return cloneWith(c, { barIndex: prevBar, beatIndex: lastBeat })
  }

  /**
   * Move one beat to the right.
   * If at the last beat of a bar: moves to first beat of next bar.
   * If at the last beat of the last bar: stays.
   */
  moveRight(score: ScoreNode): Cursor {
    const c = this.cursor
    const last = lastBeatIndex(score, c.trackIndex, c.barIndex, c.voiceIndex)

    if (c.beatIndex < last) {
      return cloneWith(c, { beatIndex: c.beatIndex + 1 })
    }

    const bars = barCount(score, c.trackIndex)
    if (c.barIndex >= bars - 1) {
      return c // already at very end
    }

    return cloneWith(c, { barIndex: c.barIndex + 1, beatIndex: 0 })
  }

  /**
   * Move to a higher string (lower string number = higher pitch).
   * Clamps at stringIndex 1.
   */
  moveUp(): Cursor {
    const c = this.cursor
    if (c.stringIndex <= 1) return c
    return cloneWith(c, { stringIndex: c.stringIndex - 1 })
  }

  /**
   * Move to a lower string (higher string number = lower pitch).
   * Clamps at the track's total string count.
   */
  moveDown(score: ScoreNode): Cursor {
    const c = this.cursor
    const max = stringCount(score, c.trackIndex)
    if (c.stringIndex >= max) return c
    return cloneWith(c, { stringIndex: c.stringIndex + 1 })
  }

  /** Jump to beat 0 of the next bar. Stays if already in last bar. */
  moveToNextBar(score: ScoreNode): Cursor {
    const c = this.cursor
    const bars = barCount(score, c.trackIndex)
    if (c.barIndex >= bars - 1) return c
    return cloneWith(c, { barIndex: c.barIndex + 1, beatIndex: 0 })
  }

  /** Jump to beat 0 of the previous bar. Stays at bar 0. */
  moveToPrevBar(): Cursor {
    const c = this.cursor
    if (c.barIndex === 0) return c
    return cloneWith(c, { barIndex: c.barIndex - 1, beatIndex: 0 })
  }

  /** Jump to track 0, bar 0, beat 0. */
  moveToStart(): Cursor {
    return { ...DEFAULT_CURSOR, stringIndex: this.cursor.stringIndex }
  }

  /** Jump to the last beat of the last bar. */
  moveToEnd(score: ScoreNode): Cursor {
    const c = this.cursor
    const bars = barCount(score, c.trackIndex)
    if (bars === 0) return c
    const lastBar = bars - 1
    const lastBeat = lastBeatIndex(score, c.trackIndex, lastBar, c.voiceIndex)
    return cloneWith(c, { barIndex: lastBar, beatIndex: lastBeat })
  }

  // ---------------------------------------------------------------------------
  // Selection mutations
  // ---------------------------------------------------------------------------

  /**
   * Extend (or create) a range selection one beat to the right.
   * The anchor stays fixed; the focus advances.
   */
  selectToRight(score: ScoreNode): void {
    const anchor =
      this._selection.kind === 'range'
        ? this._selection.anchor
        : this.cursor

    const currentFocus =
      this._selection.kind === 'range'
        ? this._selection.focus
        : this.cursor

    const tempModel = new SelectionModel(currentFocus)
    const newFocus = tempModel.moveRight(score)

    this._selection = { kind: 'range', anchor, focus: newFocus }
  }

  /** Collapse any range selection to a caret at the focus position. */
  clearToCaret(): void {
    const c = this.cursor
    this._selection = { kind: 'caret', cursor: c }
  }

  // ---------------------------------------------------------------------------
  // Direct setters
  // ---------------------------------------------------------------------------

  /** Directly set the cursor (collapses to caret). */
  setCursor(cursor: Cursor): void {
    this._selection = { kind: 'caret', cursor }
  }

  /**
   * Set a single-note selection (Sibelius-style notehead pick).
   *
   * Semantically distinct from `caret`:
   *   - `caret` = an insert position (the user is about to type a new note)
   *   - `note`  = a notehead is selected for inspection/editing without
   *               implying insert mode. Typing a digit later promotes the
   *               selection into a caret + insert mode (see commitFret).
   */
  setNote(cursor: Cursor): void {
    this._selection = { kind: 'note', cursor }
  }

  /**
   * Set cursor from a hit-test result (e.g. from AlphaTabBridge).
   * Collapses any existing range selection.
   * Preserves `stringLineY` so per-string highlight works.
   */
  setFromHitPosition(hit: {
    trackIndex: number
    barIndex: number
    voiceIndex: number
    beatIndex: number
    stringIndex: number
    stringLineY?: number
  }): void {
    this._selection = {
      kind: 'caret',
      cursor: {
        trackIndex: hit.trackIndex,
        barIndex: hit.barIndex,
        voiceIndex: hit.voiceIndex,
        beatIndex: hit.beatIndex,
        stringIndex: hit.stringIndex,
        stringLineY: hit.stringLineY,
      },
    }
  }

  /**
   * Set a bar-range selection.
   * `from` and `to` may be in any order — the overlay normalises them.
   */
  setBarRange(from: BarSpan, to: BarSpan): void {
    this._selection = { kind: 'bar', from, to }
  }
}
