/**
 * barFill.ts — bar-level beat construction & duration utilities.
 *
 * Pure functions; no React, no Zustand, no side effects.
 *
 * These are shared by:
 *   - barCommands.ts  (InsertBar / ClearBar)
 *   - TabEditorToolbar.tsx  (InsertBar before / after)
 *   - useTabEditorInput.ts  (commitFret rest-fill)
 */

import type { BeatNode, Duration, DurationNode, ScoreNode, VoiceNode } from './types'

// ---------------------------------------------------------------------------
// Duration arithmetic (64th-note units)
//   whole=64  half=32  quarter=16  eighth=8  sixteenth=4  32nd=2  64th=1
// ---------------------------------------------------------------------------

/** Convert a DurationNode to sixty-fourth-note units. */
export function durationToUnits(dur: { value: Duration; dots: 0 | 1 | 2 }): number {
  const base = 64 / dur.value
  let total = base
  let dot = base
  for (let i = 0; i < dur.dots; i++) {
    dot = Math.floor(dot / 2)
    total += dot
  }
  return total
}

/** Total bar capacity in sixty-fourth-note units for a given time signature. */
export function barCapacityUnits(ts: { numerator: number; denominator: number }): number {
  return Math.round(ts.numerator * (64 / ts.denominator))
}

/** Total duration (in 64th-note units) currently occupied by a voice's beats. */
export function voiceUsedUnits(voice: VoiceNode): number {
  return voice.beats.reduce((sum, b) => sum + durationToUnits(b.duration), 0)
}

// ---------------------------------------------------------------------------
// Effective time signature
// ---------------------------------------------------------------------------

/**
 * Walk backwards from barIndex to find the nearest explicit time signature.
 * Falls back to 4/4 when none is found.
 */
export function getEffectiveTimeSig(
  ast: ScoreNode,
  trackIndex: number,
  barIndex: number,
): { numerator: number; denominator: number } {
  const bars = ast.tracks[trackIndex]?.staves[0]?.bars ?? []
  for (let i = barIndex; i >= 0; i--) {
    const ts = bars[i]?.timeSignature
    if (ts) return ts
  }
  return { numerator: 4, denominator: 4 }
}

/**
 * Find (trackIndex, barIndex) for a bar by its id.
 * Returns null when not found.
 */
export function findBarPosition(
  ast: ScoreNode,
  barId: string,
): { trackIndex: number; barIndex: number } | null {
  for (let t = 0; t < ast.tracks.length; t++) {
    const bars = ast.tracks[t]?.staves[0]?.bars ?? []
    for (let b = 0; b < bars.length; b++) {
      if (bars[b]?.id === barId) return { trackIndex: t, barIndex: b }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Binary Fill — canonical rest decomposition
// ---------------------------------------------------------------------------

/**
 * Binary Fill Algorithm.
 *
 * Decomposes `remainingUnits` into canonical rest Duration values using binary
 * decomposition.  Rests smaller than the note's own duration are emitted first
 * (closer to the note head), then rests equal-or-larger follow in ascending
 * order toward the next beat boundary — the standard notation convention used
 * by MuseScore, Sibelius, and LilyPond.
 *
 * Examples:
 *   noteUnits=4  (16th), remaining=12 (3/16)  → [16, 8]       (16th + 8th)
 *   noteUnits=8  (8th),  remaining=8  (1/8)   → [8]           (8th rest)
 *   noteUnits=16 (qtr),  remaining=24 (3/8)   → [8, 4]        (8th + quarter)
 *   noteUnits=4,         remaining=28 (7/16)  → [16, 8, 4]    (16th+8th+quarter)
 */
export function splitIntoRests(noteUnits: number, remainingUnits: number): Duration[] {
  const small: Duration[] = []   // rests smaller than noteUnits (near the note head)
  const large: Duration[] = []   // rests >= noteUnits (toward beat boundary)
  let rem = remainingUnits

  // Binary decomposition: each set bit in `rem` maps to a power-of-2 duration.
  // Process LSB → MSB so both buckets are in ascending order.
  for (let units = 1; units <= 64 && rem > 0; units *= 2) {
    if (rem & units) {
      const dur = (64 / units) as Duration
      if (units < noteUnits) {
        small.push(dur)
      } else {
        large.push(dur)
      }
      rem -= units
    }
  }

  return [...small, ...large]
}

// ---------------------------------------------------------------------------
// Bar beat construction
// ---------------------------------------------------------------------------

/**
 * Build the initial list of rest beats for a new / cleared bar.
 *
 * For 4/4  → 4 × quarter rests      [q, q, q, q]
 * For 3/4  → 3 × quarter rests      [q, q, q]
 * For 6/8  → 6 × eighth rests       [e, e, e, e, e, e]
 * For 9/8  → 9 × eighth rests
 * For 12/8 → 12 × eighth rests
 * For 5/4  → 5 × quarter rests
 */
export function makeBarBeats(
  ts: { numerator: number; denominator: number },
  generateId: () => string,
): BeatNode[] {
  const durValue = ts.denominator as Duration
  return Array.from({ length: ts.numerator }, () => ({
    id: generateId(),
    duration: { value: durValue, dots: 0 as const } satisfies DurationNode,
    notes: [],
    rest: true as const,
  }))
}
