/**
 * hitTest unit tests.
 *
 * Constructs minimal boundsLookup mocks that mirror the alphaTab 1.8.1
 * BoundsLookup shape used by hitTest.ts at runtime.
 */

import { describe, it, expect } from 'vitest'
import { hitTest } from '../hitTest'

// ---------------------------------------------------------------------------
// Test-fixture helpers
// ---------------------------------------------------------------------------

interface FakeBeat {
  index: number
  voice: {
    index: number
    bar: {
      index: number
      staff: { track: { index: number } }
    }
  }
}

interface FakeBeatBounds {
  beat: FakeBeat
  visualBounds: { x: number; y: number; w: number; h: number }
  realBounds: { x: number; y: number; w: number; h: number }
}

interface FakeBarBounds {
  visualBounds: { x: number; y: number; w: number; h: number }
  realBounds: { x: number; y: number; w: number; h: number }
  lineAlignedBounds?: { x: number; y: number; w: number; h: number }
  beats: FakeBeatBounds[]
}

interface FakeMasterBarBounds {
  index: number
  visualBounds: { x: number; y: number; w: number; h: number }
  realBounds: { x: number; y: number; w: number; h: number }
  lineAlignedBounds: { x: number; y: number; w: number; h: number }
  bars: FakeBarBounds[]
}

function makeBeat(
  barIndex: number,
  beatIndex: number,
  trackIndex = 0,
  voiceIndex = 0,
): FakeBeat {
  return {
    index: beatIndex,
    voice: {
      index: voiceIndex,
      bar: {
        index: barIndex,
        staff: { track: { index: trackIndex } },
      },
    },
  }
}

function makeBeatBounds(
  beat: FakeBeat,
  x: number,
  y: number,
  w = 40,
  h = 30,
): FakeBeatBounds {
  return {
    beat,
    visualBounds: { x, y, w, h },
    realBounds: { x, y, w, h },
  }
}

function makeMasterBarBounds(
  barIndex: number,
  beatBoundsList: FakeBeatBounds[],
  x = 0,
  y = 0,
  w = 400,
  h = 80,
): FakeMasterBarBounds {
  const barBounds: FakeBarBounds = {
    visualBounds: { x, y, w, h },
    realBounds: { x, y, w, h },
    lineAlignedBounds: { x, y, w, h },
    beats: beatBoundsList,
  }
  return {
    index: barIndex,
    visualBounds: { x, y, w, h },
    realBounds: { x, y, w, h },
    lineAlignedBounds: { x, y, w, h },
    bars: [barBounds],
  }
}

/**
 * Build a minimal fake BoundsLookup with a simple `getBeatAtPos` that checks
 * whether (x,y) falls inside any beat's visualBounds.
 */
function makeBoundsLookup(masterBars: FakeMasterBarBounds[]) {
  const masterBarMap = new Map<number, FakeMasterBarBounds>(
    masterBars.map((mb) => [mb.index, mb]),
  )

  function getBeatAtPos(x: number, y: number): FakeBeat | null {
    for (const mb of masterBars) {
      for (const bar of mb.bars) {
        for (const bb of bar.beats) {
          const { x: bx, y: by, w, h } = bb.visualBounds
          if (x >= bx && x <= bx + w && y >= by && y <= by + h) {
            return bb.beat
          }
        }
      }
    }
    return null
  }

  return {
    staffSystems: [
      {
        visualBounds: { x: 0, y: 0, w: 800, h: 300 },
        realBounds: { x: 0, y: 0, w: 800, h: 300 },
        bars: masterBars,
      },
    ],
    getBeatAtPos,
    findMasterBarByIndex: (index: number) => masterBarMap.get(index) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hitTest — direct hit', () => {
  it('returns the beat at (x, y) when cursor is inside a beat rect', () => {
    const beat0 = makeBeat(0, 0)
    const beat1 = makeBeat(0, 1)
    const bb0 = makeBeatBounds(beat0, 10, 20, 40, 30)
    const bb1 = makeBeatBounds(beat1, 60, 20, 40, 30)
    const lookup = makeBoundsLookup([makeMasterBarBounds(0, [bb0, bb1], 0, 0, 400, 80)])

    // Click inside beat 1's bounds
    const result = hitTest(lookup, 80, 35, 6)

    expect(result).not.toBeNull()
    expect(result!.barIndex).toBe(0)
    expect(result!.beatIndex).toBe(1)
    expect(result!.trackIndex).toBe(0)
    expect(result!.voiceIndex).toBe(0)
  })
})

describe('hitTest — between beats (fallback heuristic)', () => {
  it('returns the nearest beat when cursor is between two beats', () => {
    const beat0 = makeBeat(0, 0)
    const beat1 = makeBeat(0, 1)
    // beat0 centre at x=30, beat1 centre at x=130
    const bb0 = makeBeatBounds(beat0, 10, 20, 40, 30)
    const bb1 = makeBeatBounds(beat1, 110, 20, 40, 30)
    const lookup = makeBoundsLookup([makeMasterBarBounds(0, [bb0, bb1], 0, 0, 400, 80)])

    // x=75 → equidistant but closer to beat0 centre(30) vs beat1 centre(130)?
    // distance to beat0 centre: |75-30| = 45
    // distance to beat1 centre: |75-130| = 55
    // → nearest is beat0
    const result = hitTest(lookup, 75, 35, 6)

    expect(result).not.toBeNull()
    expect(result!.beatIndex).toBe(0)
  })

  it('returns nearest beat on the right when closer', () => {
    const beat0 = makeBeat(0, 0)
    const beat1 = makeBeat(0, 1)
    const bb0 = makeBeatBounds(beat0, 10, 20, 40, 30)
    const bb1 = makeBeatBounds(beat1, 110, 20, 40, 30)
    const lookup = makeBoundsLookup([makeMasterBarBounds(0, [bb0, bb1], 0, 0, 400, 80)])

    // x=105 → closer to beat1 centre at 130 (dist 25) than beat0 centre at 30 (dist 75)
    const result = hitTest(lookup, 105, 35, 6)

    expect(result).not.toBeNull()
    expect(result!.beatIndex).toBe(1)
  })
})

describe('hitTest — outside all beats', () => {
  it('returns null when boundsLookup is null', () => {
    expect(hitTest(null, 100, 100, 6)).toBeNull()
  })

  it('returns null when staffSystems is empty', () => {
    const lookup = {
      staffSystems: [],
      getBeatAtPos: () => null,
      findMasterBarByIndex: () => null,
    }
    expect(hitTest(lookup, 999, 999, 6)).toBeNull()
  })
})

describe('hitTest — string index derivation', () => {
  it('returns stringIndex=1 when y is at the top of the staff', () => {
    // Staff: y=0, h=60, 6 strings
    // Top of staff → string 1
    const beat = makeBeat(0, 0)
    const bb = makeBeatBounds(beat, 0, 0, 400, 60)
    const lookup = makeBoundsLookup([makeMasterBarBounds(0, [bb], 0, 0, 400, 60)])

    const result = hitTest(lookup, 200, 0, 6)
    expect(result).not.toBeNull()
    expect(result!.stringIndex).toBe(1)
  })

  it('returns stringIndex=6 when y is at the bottom of the staff (6 strings)', () => {
    // Staff: y=0, h=60, 6 strings
    // Bottom of staff → string 6
    const beat = makeBeat(0, 0)
    const bb = makeBeatBounds(beat, 0, 0, 400, 60)
    const lookup = makeBoundsLookup([makeMasterBarBounds(0, [bb], 0, 0, 400, 60)])

    const result = hitTest(lookup, 200, 60, 6)
    expect(result).not.toBeNull()
    expect(result!.stringIndex).toBe(6)
  })

  it('returns stringIndex=1 for single-string tracks', () => {
    const beat = makeBeat(0, 0)
    const bb = makeBeatBounds(beat, 0, 0, 400, 40)
    const lookup = makeBoundsLookup([makeMasterBarBounds(0, [bb], 0, 0, 400, 40)])

    const result = hitTest(lookup, 100, 20, 1)
    expect(result).not.toBeNull()
    expect(result!.stringIndex).toBe(1)
  })

  it('derives mid-staff string correctly for 4 strings', () => {
    // Staff y=0, h=60, 4 strings: slot height = 60/3 = 20
    // y=30 → ratio = 0.5 → round(0.5*3) + 1 = 2 or 3
    const beat = makeBeat(0, 0)
    const bb = makeBeatBounds(beat, 0, 0, 400, 60)
    const lookup = makeBoundsLookup([makeMasterBarBounds(0, [bb], 0, 0, 400, 60)])

    const result = hitTest(lookup, 200, 30, 4)
    expect(result).not.toBeNull()
    // Middle y should yield string 2 or 3 (both valid due to rounding)
    expect(result!.stringIndex).toBeGreaterThanOrEqual(2)
    expect(result!.stringIndex).toBeLessThanOrEqual(3)
  })
})
