/**
 * OverlayLayer unit tests.
 *
 * AlphaTabBridge.getBeatRect() is mocked so these tests are pure TS with no
 * alphaTab dependency at runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OverlayLayer } from '../overlayLayer'
import type { AlphaTabBridge, BeatBoundsRect, HitPosition } from '../alphaTabBridge'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePos(overrides?: Partial<HitPosition>): HitPosition {
  return {
    trackIndex: 0,
    barIndex: 0,
    voiceIndex: 0,
    beatIndex: 0,
    stringIndex: 1,
    ...overrides,
  }
}

function makeRect(overrides?: Partial<BeatBoundsRect>): BeatBoundsRect {
  return { x: 10, y: 20, w: 40, h: 30, ...overrides }
}

function makeBridge(getBeatRect: (t: number, b: number, v: number, beat: number) => BeatBoundsRect | null): AlphaTabBridge {
  return { getBeatRect } as unknown as AlphaTabBridge
}

// ---------------------------------------------------------------------------
// getCursorRect
// ---------------------------------------------------------------------------

describe('OverlayLayer.getCursorRect', () => {
  it('returns null when bridge has no rect for the position', () => {
    const bridge = makeBridge(() => null)
    const layer = new OverlayLayer(bridge)
    expect(layer.getCursorRect(makePos())).toBeNull()
  })

  it('returns a thin vertical bar at the left edge of the beat bounds', () => {
    const beatRect = makeRect({ x: 50, y: 100, w: 60, h: 30 })
    const bridge = makeBridge(() => beatRect)
    const layer = new OverlayLayer(bridge)

    const result = layer.getCursorRect(makePos())

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('cursor')
    // x aligns with left edge of beat
    expect(result!.x).toBe(beatRect.x)
    // cursor is narrow (2px)
    expect(result!.width).toBe(2)
    // height should be at least the beat height (expanded by vertical padding)
    expect(result!.height).toBeGreaterThanOrEqual(beatRect.h)
    // top should be at or above the beat rect top
    expect(result!.y).toBeLessThanOrEqual(beatRect.y)
  })

  it('passes the correct trackIndex/barIndex/voiceIndex/beatIndex to bridge', () => {
    const getBeatRect = vi.fn().mockReturnValue(makeRect())
    const bridge = makeBridge(getBeatRect)
    const layer = new OverlayLayer(bridge)
    const pos = makePos({ trackIndex: 1, barIndex: 3, voiceIndex: 0, beatIndex: 2 })

    layer.getCursorRect(pos)

    expect(getBeatRect).toHaveBeenCalledWith(1, 3, 0, 2)
  })
})

// ---------------------------------------------------------------------------
// getSelectionRects — same bar/voice
// ---------------------------------------------------------------------------

describe('OverlayLayer.getSelectionRects — same bar', () => {
  it('returns one rect per beat between from and to (inclusive)', () => {
    const getBeatRect = vi.fn((t: number, b: number, v: number, beat: number) =>
      makeRect({ x: beat * 50, y: 100, w: 40, h: 30 }),
    )
    const bridge = makeBridge(getBeatRect)
    const layer = new OverlayLayer(bridge)

    const from = makePos({ beatIndex: 1 })
    const to = makePos({ beatIndex: 3 })

    const rects = layer.getSelectionRects(from, to)

    expect(rects).toHaveLength(3) // beats 1, 2, 3
    rects.forEach((r) => expect(r.kind).toBe('selection'))
  })

  it('handles reversed from/to order correctly', () => {
    const getBeatRect = vi.fn((t: number, b: number, v: number, beat: number) =>
      makeRect({ x: beat * 50, y: 100, w: 40, h: 30 }),
    )
    const bridge = makeBridge(getBeatRect)
    const layer = new OverlayLayer(bridge)

    // from > to — should normalise internally
    const from = makePos({ beatIndex: 3 })
    const to = makePos({ beatIndex: 1 })

    const rects = layer.getSelectionRects(from, to)
    expect(rects).toHaveLength(3) // beats 1, 2, 3
  })

  it('returns a single rect when from === to', () => {
    const getBeatRect = vi.fn().mockReturnValue(makeRect())
    const bridge = makeBridge(getBeatRect)
    const layer = new OverlayLayer(bridge)

    const pos = makePos({ beatIndex: 2 })
    const rects = layer.getSelectionRects(pos, pos)

    expect(rects).toHaveLength(1)
  })

  it('returns empty array when bridge returns null for all beats', () => {
    const bridge = makeBridge(() => null)
    const layer = new OverlayLayer(bridge)

    const rects = layer.getSelectionRects(makePos({ beatIndex: 0 }), makePos({ beatIndex: 2 }))
    expect(rects).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// getSelectionRects — cross-bar
// ---------------------------------------------------------------------------

describe('OverlayLayer.getSelectionRects — cross-bar', () => {
  it('returns rects spanning multiple bars until bridge returns null', () => {
    // 3 bars, 2 beats each → 6 beats total if covering bars 0→2
    const getBeatRect = vi.fn(
      (t: number, bar: number, v: number, beat: number): BeatBoundsRect | null => {
        if (beat >= 2) return null // only 2 beats per bar
        return makeRect({ x: bar * 200 + beat * 50, y: 100, w: 40, h: 30 })
      },
    )
    const bridge = makeBridge(getBeatRect)
    const layer = new OverlayLayer(bridge)

    const from = makePos({ barIndex: 0, beatIndex: 0 })
    const to = makePos({ barIndex: 2, beatIndex: 1 })

    const rects = layer.getSelectionRects(from, to)
    // bar 0: beats 0,1 | bar 1: beats 0,1 | bar 2: beats 0,1 → 6
    expect(rects).toHaveLength(6)
    rects.forEach((r) => expect(r.kind).toBe('selection'))
  })
})

// ---------------------------------------------------------------------------
// getHoverRect
// ---------------------------------------------------------------------------

describe('OverlayLayer.getHoverRect', () => {
  it('returns null when bridge has no rect', () => {
    const bridge = makeBridge(() => null)
    const layer = new OverlayLayer(bridge)
    expect(layer.getHoverRect(makePos())).toBeNull()
  })

  it('returns a hover rect with kind="hover"', () => {
    const beatRect = makeRect({ x: 30, y: 80, w: 50, h: 25 })
    const bridge = makeBridge(() => beatRect)
    const layer = new OverlayLayer(bridge)

    const result = layer.getHoverRect(makePos())

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('hover')
    expect(result!.x).toBe(beatRect.x)
    expect(result!.width).toBe(beatRect.w)
    expect(result!.height).toBeGreaterThanOrEqual(beatRect.h)
  })
})
