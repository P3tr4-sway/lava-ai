/**
 * tieResolver tests — Sibelius-style tie rules.
 *
 * We build minimal AST fixtures (skipping the full parser) to keep each case
 * targeted. Cases covered:
 *   1. same pitch next beat            → ok
 *   2. different fret on same string   → pitch-mismatch
 *   3. different string                → pitch-mismatch
 *   4. next beat is a rest             → rest
 *   5. no next beat in bar, no next bar → no-next-beat
 *   6. cross-bar: next bar first beat  → ok (destBarIndex advances)
 *   7. no source note on cursor string → no-source
 *   8. dest.tie pre-set → still ok; caller toggles off via undefined
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { resolveTieTarget } from '../tieResolver'
import type { BarNode, BeatNode, NoteNode, ScoreNode } from '../types'

// ---------------------------------------------------------------------------
// Fixture builders
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

describe('resolveTieTarget', () => {
  it('resolves same-pitch note on next beat', () => {
    const n1 = note({ string: 6, fret: 3 })
    const n2 = note({ string: 6, fret: 3 })
    const ast = score([bar([beat([n1]), beat([n2])])])

    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.target.dest.id).toBe(n2.id)
      expect(res.target.destLoc.noteId).toBe(n2.id)
      expect(res.target.destBarIndex).toBe(0)
    }
  })

  it('rejects when next beat has a different fret on the same string', () => {
    const ast = score([
      bar([
        beat([note({ string: 6, fret: 3 })]),
        beat([note({ string: 6, fret: 5 })]),
      ]),
    ])
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('pitch-mismatch')
  })

  it('rejects when next beat has the fret on a different string', () => {
    const ast = score([
      bar([
        beat([note({ string: 6, fret: 3 })]),
        beat([note({ string: 5, fret: 3 })]),
      ]),
    ])
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('pitch-mismatch')
  })

  it('rejects when next beat is a rest', () => {
    const ast = score([
      bar([
        beat([note({ string: 6, fret: 3 })]),
        beat([], { rest: true }),
      ]),
    ])
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('rest')
  })

  it('returns no-next-beat at end of track', () => {
    const ast = score([bar([beat([note({ string: 6, fret: 3 })])])])
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('no-next-beat')
  })

  it('crosses bar line to first beat of next bar', () => {
    const srcNote = note({ string: 6, fret: 3 })
    const destNote = note({ string: 6, fret: 3 })
    const ast = score([
      bar([beat([srcNote])]),
      bar([beat([destNote])]),
    ])
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
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
        beat([note({ string: 6, fret: 3 })]),
      ]),
    ])
    // cursor string=4, but no note on string 4 in source beat
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 4)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('no-source')
  })

  it('resolves even when destination already has tie=true (caller toggles off)', () => {
    const ast = score([
      bar([
        beat([note({ string: 6, fret: 3 })]),
        beat([note({ string: 6, fret: 3, tie: true })]),
      ]),
    ])
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.target.dest.tie).toBe(true)
  })

  it('skips to next-next bar when an intermediate bar has no matching voice', () => {
    const srcNote = note({ string: 6, fret: 3 })
    const destNote = note({ string: 6, fret: 3 })
    const ast = score([
      bar([beat([srcNote])]),
      { id: id('bar'), voices: [] }, // no voice 0 at all
      bar([beat([destNote])]),
    ])
    const res = resolveTieTarget(ast, 0, 0, 0, 0, 6)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.target.destBarIndex).toBe(2)
  })
})
