/**
 * astDiff unit tests.
 *
 * Pure TypeScript — no DOM, no alphaTab.
 */

import { describe, it, expect } from 'vitest'
import { diffAst } from '../astDiff'
import type { ScoreNode, BarNode, TrackNode } from '../../editor/ast/types'
import { nanoid } from 'nanoid'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBar(overrides?: Partial<BarNode>): BarNode {
  return {
    id: nanoid(),
    voices: [
      {
        id: nanoid(),
        beats: [
          {
            id: nanoid(),
            duration: { value: 4, dots: 0 },
            notes: [{ id: nanoid(), string: 1, fret: 5 }],
          },
        ],
      },
    ],
    ...overrides,
  }
}

function makeTrack(bars: BarNode[], overrides?: Partial<TrackNode>): TrackNode {
  return {
    id: nanoid(),
    name: 'Track 1',
    instrument: 25,
    tuning: [40, 45, 50, 55, 59, 64],
    capo: 0,
    chordDefs: [],
    staves: [{ id: nanoid(), bars }],
    ...overrides,
  }
}

function makeScore(tracks: TrackNode[]): ScoreNode {
  return {
    id: nanoid(),
    meta: { tempo: 120 },
    tracks,
  }
}

/** Deep clone via JSON round-trip. */
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('diffAst', () => {
  it('same AST twice → no changes, no full render required', () => {
    const bar = makeBar()
    const score = makeScore([makeTrack([bar])])
    const diff = diffAst(score, clone(score))

    expect(diff.changedBarIds).toHaveLength(0)
    expect(diff.metaChanged).toBe(false)
    expect(diff.tracksChanged).toBe(false)
    expect(diff.requiresFullRender).toBe(false)
  })

  it('change one bar note → only that bar ID in changedBarIds', () => {
    const bar1 = makeBar()
    const bar2 = makeBar()
    const score = makeScore([makeTrack([bar1, bar2])])

    const next = clone(score)
    // Mutate bar1's fret in the clone
    next.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret = 99

    const diff = diffAst(score, next)

    expect(diff.changedBarIds).toHaveLength(1)
    expect(diff.changedBarIds[0]).toBe(bar1.id)
    expect(diff.metaChanged).toBe(false)
    expect(diff.requiresFullRender).toBe(false)
  })

  it('change meta (tempo) → metaChanged true, requiresFullRender true', () => {
    const score = makeScore([makeTrack([makeBar()])])
    const next = clone(score)
    next.meta.tempo = 200

    const diff = diffAst(score, next)

    expect(diff.metaChanged).toBe(true)
    expect(diff.requiresFullRender).toBe(true)
  })

  it('add a new bar → new bar ID in changedBarIds', () => {
    const bar1 = makeBar()
    const score = makeScore([makeTrack([bar1])])

    const next = clone(score)
    const newBar = makeBar()
    next.tracks[0].staves[0].bars.push(newBar)

    const diff = diffAst(score, next)

    expect(diff.changedBarIds).toContain(newBar.id)
  })

  it('remove a bar → removed bar ID in changedBarIds', () => {
    const bar1 = makeBar()
    const bar2 = makeBar()
    const score = makeScore([makeTrack([bar1, bar2])])

    const next = clone(score)
    // Remove bar2 from the clone
    next.tracks[0].staves[0].bars.splice(1, 1)

    const diff = diffAst(score, next)

    expect(diff.changedBarIds).toContain(bar2.id)
  })

  it('change >50% of bars → requiresFullRender true', () => {
    // Create 4 bars — change 3 of them (75%)
    const bars = [makeBar(), makeBar(), makeBar(), makeBar()]
    const score = makeScore([makeTrack(bars)])

    const next = clone(score)
    next.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret = 10
    next.tracks[0].staves[0].bars[1].voices[0].beats[0].notes[0].fret = 11
    next.tracks[0].staves[0].bars[2].voices[0].beats[0].notes[0].fret = 12

    const diff = diffAst(score, next)

    expect(diff.changedBarIds).toHaveLength(3)
    expect(diff.requiresFullRender).toBe(true)
  })

  it('change <50% of bars → requiresFullRender false', () => {
    // 4 bars, change 1 (25%)
    const bars = [makeBar(), makeBar(), makeBar(), makeBar()]
    const score = makeScore([makeTrack(bars)])

    const next = clone(score)
    next.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret = 99

    const diff = diffAst(score, next)

    expect(diff.changedBarIds).toHaveLength(1)
    expect(diff.requiresFullRender).toBe(false)
  })

  it('two-track score: change bar in track 2 only → only track 2 bar IDs affected', () => {
    const track1Bar = makeBar()
    const track2Bar = makeBar()
    const score = makeScore([
      makeTrack([track1Bar], { name: 'Guitar 1' }),
      makeTrack([track2Bar], { name: 'Guitar 2' }),
    ])

    const next = clone(score)
    // Mutate track 2 bar only
    next.tracks[1].staves[0].bars[0].voices[0].beats[0].notes[0].fret = 7

    const diff = diffAst(score, next)

    expect(diff.changedBarIds).toContain(track2Bar.id)
    expect(diff.changedBarIds).not.toContain(track1Bar.id)
    expect(diff.requiresFullRender).toBe(false)
  })

  it('change track tuning → tracksChanged true, requiresFullRender true', () => {
    const score = makeScore([makeTrack([makeBar()])])
    const next = clone(score)
    next.tracks[0].tuning = [38, 43, 48, 53, 57, 62] // drop D

    const diff = diffAst(score, next)

    expect(diff.tracksChanged).toBe(true)
    expect(diff.requiresFullRender).toBe(true)
  })

  it('change track instrument → tracksChanged true', () => {
    const score = makeScore([makeTrack([makeBar()])])
    const next = clone(score)
    next.tracks[0].instrument = 30

    const diff = diffAst(score, next)

    expect(diff.tracksChanged).toBe(true)
    expect(diff.requiresFullRender).toBe(true)
  })

  it('add a track → tracksChanged true, requiresFullRender true', () => {
    const score = makeScore([makeTrack([makeBar()])])
    const next = clone(score)
    next.tracks.push(makeTrack([makeBar()], { name: 'Bass' }) as unknown as TrackNode)

    const diff = diffAst(score, next)

    expect(diff.tracksChanged).toBe(true)
    expect(diff.requiresFullRender).toBe(true)
  })

  it('change bar structural property (timeSignature) → that bar in changedBarIds', () => {
    const bar = makeBar()
    const score = makeScore([makeTrack([bar])])

    const next = clone(score)
    next.tracks[0].staves[0].bars[0].timeSignature = { numerator: 3, denominator: 4 }

    const diff = diffAst(score, next)

    expect(diff.changedBarIds).toContain(bar.id)
    // 1 bar changed out of 1 total = 100% > 50% threshold → full render required
    expect(diff.requiresFullRender).toBe(true)
  })

  it('single bar score with unchanged content → no changedBarIds', () => {
    const bar = makeBar()
    const score = makeScore([makeTrack([bar])])
    const next = clone(score)
    // Change only the score-level id (not bar content)
    next.id = nanoid()

    const diff = diffAst(score, next)
    expect(diff.changedBarIds).toHaveLength(0)
    expect(diff.requiresFullRender).toBe(false)
  })
})
