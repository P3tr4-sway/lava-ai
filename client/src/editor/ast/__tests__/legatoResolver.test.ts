/**
 * legatoResolver tests — H/P, legato slide, and shift slide landing checks.
 *
 * Parallel to tieResolver.test.ts but the match rule is looser: the
 * destination only needs to be on the SAME STRING — fret may differ (H/P and
 * legato slide almost always have different frets) or be equal.
 *
 * Cases covered:
 *   1. different fret on same string   → ok (typical H/P / slide)
 *   2. same fret on same string        → ok (pitch-match is not required)
 *   3. destination on different string → no-same-string-note
 *   4. next beat is a rest             → rest
 *   5. no next beat in bar, no next bar → no-next-beat
 *   6. cross-bar: next bar first beat  → ok (destBarIndex advances)
 *   7. no source note on cursor string → no-source
 *   8. skip empty voice bar, resolve into the bar after → ok
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { resolveLegatoTarget } from '../legatoResolver'
import type { BarNode, BeatNode, NoteNode, ScoreNode } from '../types'

// ---------------------------------------------------------------------------
// Fixture builders (same shape as tieResolver.test.ts)
// ---------------------------------------------------------------------------

let idCounter = 0
const id = (prefix: string) => `${prefix}-${++idCounter}`

function note(partial: Partial<NoteNode> & { string: number; fret: number }): NoteNode {
  return { id: id('n'), ...partial }
}

function beat(notes: NoteNode[], opts: { rest?: boolean } = {}): BeatNode {
  return {
    id: id('b'),
    duration: { value: 4, dots: 0 },
    notes,
    ...(opts.rest ? { rest: true } : {}),
  }
}

function bar(beats: BeatNode[]): BarNode {
  return {
    id: id('bar'),
    voices: [{ id: id('v'), beats }],
  }
}

function score(bars: BarNode[]): ScoreNode {
  return {
    id: id('score'),
    meta: { tempo: 120 },
    tracks: [
      {
        id: id('t'),
        name: 'T',
        instrument: 24,
        tuning: [40, 45, 50, 55, 59, 64],
        capo: 0,
        chordDefs: [],
        staves: [{ id: id('st'), bars }],
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveLegatoTarget', () => {
  it('resolves different-fret note on same string (typical H/P)', () => {
    const n1 = note({ string: 6, fret: 3 })
    const n2 = note({ string: 6, fret: 5 })
    const ast = score([bar([beat([n1]), beat([n2])])])

    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.target.dest.id).toBe(n2.id)
      expect(res.target.destLoc.noteId).toBe(n2.id)
      expect(res.target.destBarIndex).toBe(0)
    }
  })

  it('also accepts same-fret note on same string (no pitch-match requirement)', () => {
    const n1 = note({ string: 6, fret: 3 })
    const n2 = note({ string: 6, fret: 3 })
    const ast = score([bar([beat([n1]), beat([n2])])])

    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.target.dest.id).toBe(n2.id)
  })

  it('rejects when next beat only has a note on a different string', () => {
    const ast = score([
      bar([
        beat([note({ string: 6, fret: 3 })]),
        beat([note({ string: 5, fret: 5 })]),
      ]),
    ])
    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('no-same-string-note')
  })

  it('rejects when next beat is a rest', () => {
    const ast = score([
      bar([
        beat([note({ string: 6, fret: 3 })]),
        beat([], { rest: true }),
      ]),
    ])
    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('rest')
  })

  it('returns no-next-beat at end of track', () => {
    const ast = score([bar([beat([note({ string: 6, fret: 3 })])])])
    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('no-next-beat')
  })

  it('crosses bar line to first beat of next bar', () => {
    const srcNote = note({ string: 6, fret: 3 })
    const destNote = note({ string: 6, fret: 7 })
    const ast = score([
      bar([beat([srcNote])]),
      bar([beat([destNote])]),
    ])
    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.target.dest.id).toBe(destNote.id)
      expect(res.target.destBarIndex).toBe(1)
    }
  })

  it('returns no-source when cursor string has no note in source beat', () => {
    const ast = score([
      bar([
        beat([note({ string: 6, fret: 3 })]),
        beat([note({ string: 6, fret: 5 })]),
      ]),
    ])
    // cursor string=4, but no note on string 4 in source beat
    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 4)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('no-source')
  })

  it('skips a bar with no matching voice and resolves into the next populated bar', () => {
    const srcNote = note({ string: 6, fret: 3 })
    const destNote = note({ string: 6, fret: 5 })
    const ast = score([
      bar([beat([srcNote])]),
      { id: id('bar'), voices: [] }, // no voice 0 at all
      bar([beat([destNote])]),
    ])
    const res = resolveLegatoTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.target.destBarIndex).toBe(2)
  })
})
