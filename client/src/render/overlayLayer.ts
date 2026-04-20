/**
 * OverlayLayer — computes SVG rect positions for cursor and selection overlays.
 *
 * Pure TypeScript class, no React. Delegates bounds lookups to AlphaTabBridge
 * so the overlay geometry always tracks the live rendered score.
 */

import type { HitPosition, AlphaTabBridge, BeatBoundsRect } from './alphaTabBridge'
import type { BarSpan } from '../editor/selection/SelectionModel'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OverlayRect {
  x: number
  y: number
  width: number
  height: number
  kind: 'cursor' | 'selection' | 'hover' | 'note'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width of the cursor bar in pixels */
const CURSOR_WIDTH = 2

/** Vertical padding added above/below the beat rect for cursor/hover */
const VERTICAL_PADDING = 4

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a BeatBoundsRect into an OverlayRect of the given kind.
 * Expands the rect vertically by VERTICAL_PADDING for visual breathing room.
 *
 * Used for `selection` and `hover` kinds — full beat-width rectangles.
 */
function beatRectToOverlay(
  rect: BeatBoundsRect,
  kind: OverlayRect['kind'],
): OverlayRect {
  return {
    x: rect.x,
    y: rect.y - VERTICAL_PADDING,
    width: rect.w,
    height: rect.h + VERTICAL_PADDING * 2,
    kind,
  }
}

/**
 * Convert a BeatBoundsRect into a thin Sibelius-style cursor line at the
 * LEFT edge of the beat. Width is fixed at CURSOR_WIDTH (2 px); height matches
 * the beat plus VERTICAL_PADDING above/below for breathing room.
 */
function beatRectToCursorLine(rect: BeatBoundsRect): OverlayRect {
  return {
    x: rect.x,
    y: rect.y - VERTICAL_PADDING,
    width: CURSOR_WIDTH,
    height: rect.h + VERTICAL_PADDING * 2,
    kind: 'cursor',
  }
}

// ---------------------------------------------------------------------------
// OverlayLayer
// ---------------------------------------------------------------------------

export class OverlayLayer {
  constructor(private readonly bridge: AlphaTabBridge) {}

  /**
   * Compute the cursor rect for a given HitPosition.
   * Returns a thin vertical bar at the left edge of the beat's bounds.
   */
  getCursorRect(pos: HitPosition): OverlayRect | null {
    const rect = this.bridge.getBeatRect(
      pos.trackIndex,
      pos.barIndex,
      pos.voiceIndex,
      pos.beatIndex,
    )
    if (!rect) return null

    return beatRectToCursorLine(rect)
  }

  /**
   * Compute selection rects for a range of positions.
   * Returns one rect per beat, filled semi-transparently.
   *
   * The range is inclusive: both `from` and `to` positions are included.
   * When `from` and `to` are in the same bar and voice, only beats between
   * their indices (inclusive) are included. Cross-bar ranges return one rect
   * per beat that can be resolved from the bridge.
   */
  getSelectionRects(from: HitPosition, to: HitPosition): OverlayRect[] {
    const rects: OverlayRect[] = []

    // Normalise the range so fromPos always comes first
    const [fromPos, toPos] = this.normaliseRange(from, to)

    // If same track/bar/voice, iterate beats by index
    if (
      fromPos.trackIndex === toPos.trackIndex &&
      fromPos.barIndex === toPos.barIndex &&
      fromPos.voiceIndex === toPos.voiceIndex
    ) {
      const lo = Math.min(fromPos.beatIndex, toPos.beatIndex)
      const hi = Math.max(fromPos.beatIndex, toPos.beatIndex)
      for (let beatIdx = lo; beatIdx <= hi; beatIdx++) {
        const rect = this.bridge.getBeatRect(
          fromPos.trackIndex,
          fromPos.barIndex,
          fromPos.voiceIndex,
          beatIdx,
        )
        if (rect) rects.push(beatRectToOverlay(rect, 'selection'))
      }
      return rects
    }

    // Cross-bar range: iterate bars
    const barLo = Math.min(fromPos.barIndex, toPos.barIndex)
    const barHi = Math.max(fromPos.barIndex, toPos.barIndex)

    for (let barIdx = barLo; barIdx <= barHi; barIdx++) {
      // Determine beat range within this bar
      const isFirstBar = barIdx === fromPos.barIndex
      const isLastBar = barIdx === toPos.barIndex

      // We don't know the exact beat count per bar here, so we iterate from
      // the known start/end beat and stop when getBeatRect returns null,
      // indicating we've exhausted beats in this bar.
      const startBeat = isFirstBar ? fromPos.beatIndex : 0
      // For the last bar, iterate up to toPos.beatIndex; otherwise go as far
      // as the bridge can resolve (will stop returning rects after last beat).
      const endBeat = isLastBar ? toPos.beatIndex : Number.MAX_SAFE_INTEGER

      for (let beatIdx = startBeat; beatIdx <= endBeat; beatIdx++) {
        const rect = this.bridge.getBeatRect(
          fromPos.trackIndex,
          barIdx,
          fromPos.voiceIndex,
          beatIdx,
        )
        if (!rect) break // no more beats in this bar
        rects.push(beatRectToOverlay(rect, 'selection'))
      }
    }

    return rects
  }

  /**
   * Compute the highlight rect for a single selected notehead.
   *
   * Prefer the per-note bounds reported by alphaTab (`getNoteHeadRect`) so the
   * highlight wraps the actual TAB digit. This is the Sibelius-style "the
   * number itself is selected" visual — implemented as a translucent accent
   * background rect (kind: 'selection') sized just to the digit, plus a small
   * padding so the digit isn't clipped.
   *
   * When the beat is a rest (no notehead) we fall back to a thin vertical
   * cursor tick at the clicked string row, since there's no digit to wrap.
   */
  getNoteRect(pos: HitPosition, stringCount: number): OverlayRect | null {
    const noteHead = this.bridge.getNoteHeadRect(
      pos.trackIndex,
      pos.barIndex,
      pos.voiceIndex,
      pos.beatIndex,
      pos.stringIndex,
    )
    if (noteHead) {
      const padX = 2
      const padY = 1
      return {
        x: noteHead.x - padX,
        y: noteHead.y - padY,
        width: noteHead.w + padX * 2,
        height: noteHead.h + padY * 2,
        kind: 'note',
      }
    }

    const beat = this.bridge.getBeatRect(
      pos.trackIndex,
      pos.barIndex,
      pos.voiceIndex,
      pos.beatIndex,
    )
    if (!beat) return null

    if (!pos.stringLineY) return beatRectToCursorLine(beat)

    // Rest fallback — thin vertical tick at the targeted string row.
    const perString = Math.max(beat.h / Math.max(1, stringCount - 1), 6)
    return {
      x: beat.x,
      y: pos.stringLineY - perString / 2,
      width: CURSOR_WIDTH,
      height: perString,
      kind: 'cursor',
    }
  }

  /**
   * Compute selection rects for a bar range (inclusive).
   * Returns one rect per bar, using the tab staff bounds.
   */
  getBarRects(from: BarSpan, to: BarSpan): OverlayRect[] {
    const barLo = Math.min(from.barIndex, to.barIndex)
    const barHi = Math.max(from.barIndex, to.barIndex)
    const trackIndex = from.trackIndex
    const rects: OverlayRect[] = []

    for (let barIdx = barLo; barIdx <= barHi; barIdx++) {
      const rect = this.bridge.getBarRect(trackIndex, barIdx)
      if (rect) {
        rects.push({ x: rect.x, y: rect.y, width: rect.w, height: rect.h, kind: 'selection' })
      }
    }

    return rects
  }

  /**
   * Compute hover highlight rect for a given HitPosition.
   */
  getHoverRect(pos: HitPosition): OverlayRect | null {
    const rect = this.bridge.getBeatRect(
      pos.trackIndex,
      pos.barIndex,
      pos.voiceIndex,
      pos.beatIndex,
    )
    if (!rect) return null
    return beatRectToOverlay(rect, 'hover')
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Normalise two positions so the first is always earlier in the score.
   * Compares bar → voice → beat index in order.
   */
  private normaliseRange(
    a: HitPosition,
    b: HitPosition,
  ): [HitPosition, HitPosition] {
    if (a.barIndex < b.barIndex) return [a, b]
    if (a.barIndex > b.barIndex) return [b, a]
    if (a.voiceIndex < b.voiceIndex) return [a, b]
    if (a.voiceIndex > b.voiceIndex) return [b, a]
    if (a.beatIndex <= b.beatIndex) return [a, b]
    return [b, a]
  }
}
