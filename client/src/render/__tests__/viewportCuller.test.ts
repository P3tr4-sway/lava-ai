/**
 * ViewportCuller unit tests.
 *
 * Mocks a boundsLookup with a fixed set of systems at known y positions.
 */

import { describe, it, expect } from 'vitest'
import { ViewportCuller } from '../viewportCuller'
import type { OverlayRect } from '../overlayLayer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake boundsLookup with N systems, each 100px tall, stacked vertically */
function makeBoundsLookup(
  count: number,
  systemHeight = 100,
  barsPerSystem = 4,
) {
  const staffSystems = Array.from({ length: count }, (_, i) => ({
    visualBounds: { x: 0, y: i * systemHeight, w: 800, h: systemHeight },
    realBounds: { x: 0, y: i * systemHeight, w: 800, h: systemHeight },
    bars: Array.from({ length: barsPerSystem }, (__, j) => ({
      index: i * barsPerSystem + j,
      visualBounds: { x: j * 200, y: i * systemHeight, w: 200, h: systemHeight },
      realBounds: { x: j * 200, y: i * systemHeight, w: 200, h: systemHeight },
      lineAlignedBounds: { x: j * 200, y: i * systemHeight, w: 200, h: systemHeight },
    })),
  }))
  return { staffSystems }
}

function makeOverlayRect(y: number, height = 30): OverlayRect {
  return { x: 0, y, width: 100, height, kind: 'cursor' }
}

// ---------------------------------------------------------------------------
// extractSystems
// ---------------------------------------------------------------------------

describe('ViewportCuller.extractSystems', () => {
  it('returns empty array for null/undefined boundsLookup', () => {
    const culler = new ViewportCuller()
    expect(culler.extractSystems(null)).toHaveLength(0)
    expect(culler.extractSystems(undefined)).toHaveLength(0)
  })

  it('extracts correct y/height/barIndices for each system', () => {
    const culler = new ViewportCuller()
    const lookup = makeBoundsLookup(3, 100, 4)

    const systems = culler.extractSystems(lookup)

    expect(systems).toHaveLength(3)

    expect(systems[0]).toMatchObject({ systemIndex: 0, y: 0, height: 100 })
    expect(systems[0].barIndices).toEqual([0, 1, 2, 3])

    expect(systems[1]).toMatchObject({ systemIndex: 1, y: 100, height: 100 })
    expect(systems[1].barIndices).toEqual([4, 5, 6, 7])

    expect(systems[2]).toMatchObject({ systemIndex: 2, y: 200, height: 100 })
    expect(systems[2].barIndices).toEqual([8, 9, 10, 11])
  })

  it('handles lookup with no staffSystems array', () => {
    const culler = new ViewportCuller()
    expect(culler.extractSystems({ staffSystems: null })).toHaveLength(0)
    expect(culler.extractSystems({})).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// getVisibleSystems
// ---------------------------------------------------------------------------

describe('ViewportCuller.getVisibleSystems', () => {
  const culler = new ViewportCuller()
  // 10 systems, each 100px tall → y: 0,100,200,...,900
  const lookup = makeBoundsLookup(10, 100, 4)
  const systems = culler.extractSystems(lookup)

  it('viewport at top → systems 0, 1, 2 visible (including margin)', () => {
    // viewport: y=0..600, margin=100 → window is -100..700
    // Systems at y=0 (0..100), y=100 (100..200), ..., y=600 (600..700)
    // All within -100..700 range are included
    const visible = culler.getVisibleSystems(systems, 0, 600)
    // Expected: systems 0-7 (y 0..700)
    expect(visible.length).toBeGreaterThanOrEqual(3)
    expect(visible.map((s) => s.systemIndex)).toContain(0)
    expect(visible.map((s) => s.systemIndex)).toContain(1)
    expect(visible.map((s) => s.systemIndex)).toContain(2)
  })

  it('scroll to bottom → only bottom systems returned', () => {
    // viewport height=200, scrollY=800 → visible window: 700..1100
    // Systems at y=700 (700..800), y=800 (800..900), y=900 (900..1000)
    // Margin extends to 600..1100
    const visible = culler.getVisibleSystems(systems, 800, 200)
    const indices = visible.map((s) => s.systemIndex)
    // Systems 6..9 (y=600..1000) should be visible
    expect(indices).toContain(9) // last system
    expect(indices).not.toContain(0) // first system is far away
  })

  it('viewport showing systems 0..2 only → systems 0,1,2 included', () => {
    // scrollY=0, viewportHeight=300 → window: -100..400
    // Systems 0 (0-100), 1 (100-200), 2 (200-300), 3 (300-400) within range
    const visible = culler.getVisibleSystems(systems, 0, 300)
    const indices = visible.map((s) => s.systemIndex)
    expect(indices).toContain(0)
    expect(indices).toContain(1)
    expect(indices).toContain(2)
    // System 9 should not be included
    expect(indices).not.toContain(9)
  })

  it('all systems visible when viewport encompasses full score', () => {
    // viewport height = 1200, score height = 1000 → all 10 systems visible
    const visible = culler.getVisibleSystems(systems, 0, 1200)
    expect(visible).toHaveLength(10)
  })

  it('returns empty when no systems overlap viewport', () => {
    // scroll far below all systems
    const visible = culler.getVisibleSystems(systems, 9999, 600)
    // 10 systems at y=0..900, viewport at 9999 → none visible
    expect(visible).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// cullOverlayRects
// ---------------------------------------------------------------------------

describe('ViewportCuller.cullOverlayRects', () => {
  const culler = new ViewportCuller()
  const lookup = makeBoundsLookup(10, 100, 4)
  const allSystems = culler.extractSystems(lookup)

  it('returns empty array when no visible systems', () => {
    const rects = [makeOverlayRect(50), makeOverlayRect(150)]
    expect(culler.cullOverlayRects(rects, [])).toHaveLength(0)
  })

  it('returns all rects when all systems are visible', () => {
    const rects = [
      makeOverlayRect(50),   // system 0
      makeOverlayRect(150),  // system 1
      makeOverlayRect(850),  // system 8
    ]
    const result = culler.cullOverlayRects(rects, allSystems)
    expect(result).toHaveLength(3)
  })

  it('culls rects outside visible systems', () => {
    // Only system 0 (y=0..100) is visible
    const visibleSystems = allSystems.slice(0, 1)

    const rects = [
      makeOverlayRect(50),   // inside system 0 → keep
      makeOverlayRect(550),  // inside system 5 → cull
      makeOverlayRect(950),  // inside system 9 → cull
    ]

    const result = culler.cullOverlayRects(rects, visibleSystems)
    // Only the first rect (y=50, mid=65) is inside system 0 (y=0..100 + margin)
    expect(result).toHaveLength(1)
    expect(result[0].y).toBe(50)
  })

  it('includes rects within margin above/below visible systems', () => {
    // Systems 3 (y=300..400) and 4 (y=400..500) visible
    const visibleSystems = [allSystems[3], allSystems[4]]

    // Rect at y=210 (mid=225) → 100px above system 3's top (300) → within margin
    const rectAbove = makeOverlayRect(210, 30) // mid = 225, system 3 y=300, 300-225=75 < 100
    // Rect at y=0 (mid=15) → well outside margin
    const rectFar = makeOverlayRect(0, 30)

    const result = culler.cullOverlayRects([rectAbove, rectFar], visibleSystems)
    expect(result).toContain(rectAbove)
    expect(result).not.toContain(rectFar)
  })
})
