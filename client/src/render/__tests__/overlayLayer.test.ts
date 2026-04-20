/**
 * OverlayLayer unit tests.
 *
 * AlphaTabBridge.getBeatRect() and getBarRect() are mocked so these tests are
 * pure TS with no alphaTab dependency at runtime.
 */

import { describe, it, expect, vi } from 'vitest'
import { OverlayLayer } from '../overlayLayer'
import type { AlphaTabBridge, BeatBoundsRect, HitPosition } from '../alphaTabBridge'
import type { BarSpan } from '../../editor/selection/SelectionModel'

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
    stringLineY: 0,
    onNotehead: false,
    ...overrides,
  }
}

function makeRect(overrides?: Partial<BeatBoundsRect>): BeatBoundsRect {
  return { x: 10, y: 20, w: 40, h: 30, ...overrides }
}

function makeBridge(
  getBeatRect: (t: number, b: number, v: number, beat: number) => BeatBoundsRect | null,
  getBarRect?: (t: number, b: number) => BeatBoundsRect | null,
  getNoteHeadRect?: (
    t: number,
    b: number,
    v: number,
    beat: number,
    str: number,
  ) => BeatBoundsRect | null,
): AlphaTabBridge {
  return {
    getBeatRect,
    getBarRect: getBarRect ?? (() => null),
    getNoteHeadRect: getNoteHeadRect ?? (() => null),
  } as unknown as AlphaTabBridge
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

  it('returns a thin 2-px Sibelius-style cursor line at the left edge of the beat', () => {
    const beatRect = makeRect({ x: 50, y: 100, w: 60, h: 30 })
    const bridge = makeBridge(() => beatRect)
    const layer = new OverlayLayer(bridge)

    const result = layer.getCursorRect(makePos())

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('cursor')
    // x aligns with the left edge of the beat
    expect(result!.x).toBe(beatRect.x)
    // width is a thin 2-px vertical line, not the full beat column
    expect(result!.width).toBe(2)
    // height is the beat height plus VERTICAL_PADDING (4) above and below
    expect(result!.height).toBe(beatRect.h + 8)
    // top is shifted up by VERTICAL_PADDING (4)
    expect(result!.y).toBe(beatRect.y - 4)
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

// ---------------------------------------------------------------------------
// getNoteRect
// ---------------------------------------------------------------------------

describe('OverlayLayer.getNoteRect', () => {
  it('returns null when bridge has no beat rect', () => {
    const bridge = makeBridge(() => null)
    const layer = new OverlayLayer(bridge)
    expect(layer.getNoteRect(makePos(), 6)).toBeNull()
  })

  it('falls back to a thin full-height cursor line when stringLineY is 0', () => {
    const beatRect = makeRect({ x: 10, y: 50, w: 40, h: 60 })
    const bridge = makeBridge(() => beatRect)
    const layer = new OverlayLayer(bridge)

    const result = layer.getNoteRect(makePos({ stringLineY: 0 }), 6)

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('cursor')
    // Thin 2-px line, not full beat width
    expect(result!.width).toBe(2)
    // Full beat height (+ padding) when no stringLineY
    expect(result!.height).toBeGreaterThanOrEqual(beatRect.h)
  })

  it('narrows highlight to the clicked string when stringLineY is given', () => {
    const beatRect = makeRect({ x: 10, y: 50, w: 40, h: 60 })
    const bridge = makeBridge(() => beatRect)
    const layer = new OverlayLayer(bridge)

    // 6 strings, each ~12px apart. Top string line is at y=55.
    const stringLineY = 55
    const result = layer.getNoteRect(makePos({ stringLineY }), 6)

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('cursor')
    // Thin 2-px vertical tick on the targeted string row
    expect(result!.width).toBe(2)
    // Should be much shorter than the full beat height
    expect(result!.height).toBeLessThan(beatRect.h)
    // Should be centred on stringLineY
    const center = result!.y + result!.height / 2
    expect(center).toBeCloseTo(stringLineY, 0)
  })

  it('returns minimum height of 6px even for dense string spacing', () => {
    // beat.h = 5 and 10 strings → per-string would be ~0.5 — should clamp to 6
    const beatRect = makeRect({ x: 0, y: 0, w: 30, h: 5 })
    const bridge = makeBridge(() => beatRect)
    const layer = new OverlayLayer(bridge)

    const result = layer.getNoteRect(makePos({ stringLineY: 3 }), 10)

    expect(result).not.toBeNull()
    expect(result!.height).toBeGreaterThanOrEqual(6)
  })

  it('uses notehead bounds (kind: "note") when bridge has per-note bounds', () => {
    // When alphaTab reports a notehead rect for the targeted string, we
    // highlight just the digit (slightly padded) instead of drawing a cursor
    // line — matches the Sibelius convention "the number itself is selected".
    const noteHeadRect = makeRect({ x: 100, y: 200, w: 14, h: 16 })
    const bridge = makeBridge(
      () => makeRect(), // beat exists
      () => null,
      () => noteHeadRect,
    )
    const layer = new OverlayLayer(bridge)

    const result = layer.getNoteRect(makePos(), 6)

    expect(result).not.toBeNull()
    expect(result!.kind).toBe('note')
    // Padded by 2px horizontally and 1px vertically.
    expect(result!.x).toBe(noteHeadRect.x - 2)
    expect(result!.y).toBe(noteHeadRect.y - 1)
    expect(result!.width).toBe(noteHeadRect.w + 4)
    expect(result!.height).toBe(noteHeadRect.h + 2)
  })
})

// ---------------------------------------------------------------------------
// getBarRects
// ---------------------------------------------------------------------------

describe('OverlayLayer.getBarRects', () => {
  it('returns empty array when bridge returns null for all bars', () => {
    const bridge = makeBridge(() => null, () => null)
    const layer = new OverlayLayer(bridge)
    const from: BarSpan = { trackIndex: 0, barIndex: 0 }
    const to: BarSpan = { trackIndex: 0, barIndex: 2 }
    expect(layer.getBarRects(from, to)).toHaveLength(0)
  })

  it('returns one rect per bar (inclusive)', () => {
    const getBarRect = vi.fn((_t: number, barIdx: number) =>
      makeRect({ x: barIdx * 200, y: 10, w: 180, h: 80 }),
    )
    const bridge = makeBridge(() => null, getBarRect)
    const layer = new OverlayLayer(bridge)

    const from: BarSpan = { trackIndex: 0, barIndex: 2 }
    const to: BarSpan = { trackIndex: 0, barIndex: 4 }

    const rects = layer.getBarRects(from, to)

    expect(rects).toHaveLength(3) // bars 2, 3, 4
    rects.forEach((r) => expect(r.kind).toBe('selection'))
    expect(getBarRect).toHaveBeenCalledWith(0, 2)
    expect(getBarRect).toHaveBeenCalledWith(0, 3)
    expect(getBarRect).toHaveBeenCalledWith(0, 4)
  })

  it('normalises reversed from/to (to before from)', () => {
    const getBarRect = vi.fn(() => makeRect())
    const bridge = makeBridge(() => null, getBarRect)
    const layer = new OverlayLayer(bridge)

    const from: BarSpan = { trackIndex: 0, barIndex: 5 }
    const to: BarSpan = { trackIndex: 0, barIndex: 3 }

    const rects = layer.getBarRects(from, to)
    expect(rects).toHaveLength(3) // bars 3, 4, 5
  })
})
