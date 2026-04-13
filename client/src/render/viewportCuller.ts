/**
 * ViewportCuller — prevents hit-testing and overlay rendering for systems
 * (rows of bars) that are outside the visible viewport.
 *
 * alphaTab groups bars into "systems" (rows). Each system maps to a
 * staffSystem entry in the boundsLookup. Bars outside the visible window
 * do not need selection/hover overlays rendered, saving DOM work.
 */

import type { OverlayRect } from './overlayLayer'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SystemBounds {
  systemIndex: number
  y: number
  height: number
  /** 0-indexed bar indices (MasterBar indices) in this system */
  barIndices: number[]
}

// ---------------------------------------------------------------------------
// Internal alphaTab shape (mirrors alphaTabBridge.ts internal types)
// ---------------------------------------------------------------------------

interface BoundsLike {
  x: number
  y: number
  w: number
  h: number
}

interface MasterBarBoundsLike {
  index: number
  visualBounds: BoundsLike
  realBounds: BoundsLike
  lineAlignedBounds: BoundsLike
}

interface StaffSystemLike {
  visualBounds: BoundsLike
  realBounds: BoundsLike
  bars: MasterBarBoundsLike[]
}

interface BoundsLookupLike {
  staffSystems: StaffSystemLike[]
}

// ---------------------------------------------------------------------------
// ViewportCuller
// ---------------------------------------------------------------------------

/** Margin in pixels — pre-load one system above/below the visible viewport */
const VIEWPORT_MARGIN = 100

export class ViewportCuller {
  /**
   * Extract system bounds from alphaTab's boundsLookup.
   *
   * alphaTab stores rendered rows as `staffSystems`, each containing an array
   * of `MasterBarBounds`. We map each staffSystem → SystemBounds.
   */
  extractSystems(boundsLookup: unknown): SystemBounds[] {
    if (!boundsLookup) return []

    const lookup = boundsLookup as BoundsLookupLike
    if (!Array.isArray(lookup.staffSystems)) return []

    const systems: SystemBounds[] = []

    for (let i = 0; i < lookup.staffSystems.length; i++) {
      const sys = lookup.staffSystems[i]

      // Prefer lineAlignedBounds → realBounds → visualBounds for y/height
      const bounds: BoundsLike =
        (sys as unknown as { lineAlignedBounds?: BoundsLike }).lineAlignedBounds ??
        sys.realBounds ??
        sys.visualBounds

      if (!bounds) continue

      const barIndices = (sys.bars ?? []).map((b) => b.index)

      systems.push({
        systemIndex: i,
        y: bounds.y,
        height: bounds.h,
        barIndices,
      })
    }

    return systems
  }

  /**
   * Return the subset of systems whose vertical extent overlaps the visible
   * viewport window [scrollY - margin, scrollY + viewportHeight + margin].
   */
  getVisibleSystems(
    systems: SystemBounds[],
    scrollY: number,
    viewportHeight: number,
  ): SystemBounds[] {
    const top = scrollY - VIEWPORT_MARGIN
    const bottom = scrollY + viewportHeight + VIEWPORT_MARGIN

    return systems.filter((sys) => {
      const sysBottom = sys.y + sys.height
      // System is visible if it overlaps [top, bottom]
      return sysBottom >= top && sys.y <= bottom
    })
  }

  /**
   * Filter overlay rects to only those that fall within visible systems.
   *
   * A rect is culled if its vertical midpoint does not lie within any
   * visible system's vertical extent (with the margin already applied via
   * getVisibleSystems).
   */
  cullOverlayRects(
    rects: OverlayRect[],
    visibleSystems: SystemBounds[],
  ): OverlayRect[] {
    if (visibleSystems.length === 0) return []

    return rects.filter((rect) => {
      const mid = rect.y + rect.height / 2
      return visibleSystems.some(
        (sys) => mid >= sys.y - VIEWPORT_MARGIN && mid <= sys.y + sys.height + VIEWPORT_MARGIN,
      )
    })
  }
}
