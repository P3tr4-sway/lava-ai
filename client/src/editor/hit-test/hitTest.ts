/**
 * hitTest — coordinate → AST position resolution.
 *
 * Pure function: takes alphaTab's boundsLookup (passed as `unknown` to avoid
 * a hard import of alphaTab in modules that only need hit-testing) plus mouse
 * coordinates, and returns the nearest beat position in the AST.
 *
 * Falls back to the nearest beat heuristic for empty areas between beats.
 * Returns null when no score is loaded or the position is entirely outside
 * all rendered content.
 */

import type { HitPosition } from '../../render/alphaTabBridge'

// ---------------------------------------------------------------------------
// Internal shape types (mirrors what alphaTab 1.8.1 exposes at runtime)
// ---------------------------------------------------------------------------

interface AlphaBoundsLike {
  x: number
  y: number
  w: number
  h: number
}

interface AlphaBeat {
  index: number
  voice: {
    index: number
    bar: {
      index: number
      staff: {
        track: {
          index: number
        }
      }
    }
  }
}

interface AlphaBeatBounds {
  beat: AlphaBeat
  visualBounds: AlphaBoundsLike
  realBounds: AlphaBoundsLike
}

interface AlphaBarBounds {
  visualBounds: AlphaBoundsLike
  realBounds: AlphaBoundsLike
  lineAlignedBounds?: AlphaBoundsLike
  beats: AlphaBeatBounds[]
}

interface AlphaMasterBarBounds {
  index: number
  visualBounds: AlphaBoundsLike
  realBounds: AlphaBoundsLike
  lineAlignedBounds: AlphaBoundsLike
  bars: AlphaBarBounds[]
}

interface AlphaStaffSystemBounds {
  visualBounds: AlphaBoundsLike
  realBounds: AlphaBoundsLike
  bars: AlphaMasterBarBounds[]
}

interface AlphaBoundsLookup {
  staffSystems: AlphaStaffSystemBounds[]
  getBeatAtPos(x: number, y: number): AlphaBeat | null
  findMasterBarByIndex(index: number): AlphaMasterBarBounds | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Derive a 1-indexed string number from a y-coordinate within a tab staff bounds.
 *
 * In alphaTab's tab rendering: string 1 = thinnest (high e) = TOP line.
 * String 6 (or stringCount) = thickest (low E) = BOTTOM line.
 *
 * ratio=0 (top) → string 1, ratio=1 (bottom) → stringCount.
 */
function deriveStringIndex(
  staffBounds: AlphaBoundsLike,
  y: number,
  stringCount: number,
): number {
  if (stringCount <= 1) return 1
  const ratio = clamp((y - staffBounds.y) / Math.max(staffBounds.h, 1), 0, 1)
  return clamp(Math.round(ratio * (stringCount - 1)) + 1, 1, stringCount)
}

/**
 * Pick the best bounds rect from an AlphaBarBounds.
 * Prefers lineAlignedBounds → realBounds → visualBounds (matching TabCanvas).
 */
function preferredBounds(bar: AlphaBarBounds): AlphaBoundsLike {
  return bar.lineAlignedBounds ?? bar.realBounds ?? bar.visualBounds
}

/**
 * Find the nearest beat within a masterBarBounds to (x, y).
 * Used as a fallback when getBeatAtPos() returns null.
 */
function findNearestBeat(
  masterBarBounds: AlphaMasterBarBounds,
  x: number,
): AlphaBeat | null {
  let bestBeat: AlphaBeat | null = null
  let bestDist = Infinity

  for (const barBounds of masterBarBounds.bars) {
    for (const beatBounds of barBounds.beats) {
      const bounds = beatBounds.visualBounds
      const beatCenterX = bounds.x + bounds.w / 2
      const dist = Math.abs(x - beatCenterX)
      if (dist < bestDist) {
        bestDist = dist
        bestBeat = beatBounds.beat
      }
    }
  }

  return bestBeat
}

/**
 * Find the masterBarBounds whose visual bounds contain the y-coordinate,
 * or the nearest one if y is between rows.
 */
function findMasterBarAtY(
  staffSystems: AlphaStaffSystemBounds[],
  x: number,
  y: number,
): AlphaMasterBarBounds | null {
  // First pass: find a bar that geometrically contains (x, y)
  for (const system of staffSystems) {
    for (const masterBar of system.bars) {
      const b = masterBar.visualBounds
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return masterBar
      }
    }
  }

  // Second pass: find the nearest masterBar by centre-distance
  let bestBar: AlphaMasterBarBounds | null = null
  let bestDist = Infinity

  for (const system of staffSystems) {
    for (const masterBar of system.bars) {
      const b = masterBar.visualBounds
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      const dist = Math.hypot(x - cx, y - cy)
      if (dist < bestDist) {
        bestDist = dist
        bestBar = masterBar
      }
    }
  }

  return bestBar
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given a mouse (x, y) coordinate and alphaTab's boundsLookup object,
 * return the closest beat position or null if no score is loaded.
 *
 * For empty areas between beats the function returns the nearest beat.
 * stringIndex is derived from the y-position within the bar's staff area.
 *
 * @param boundsLookup  alphaTab BoundsLookup instance (typed as `unknown` to
 *                      avoid a hard import dependency on alphaTab)
 * @param x             Mouse x coordinate in alphaTab's coordinate space
 * @param y             Mouse y coordinate in alphaTab's coordinate space
 * @param stringCount   Number of strings in the track (e.g. 6 for guitar)
 */
export function hitTest(
  boundsLookup: unknown,
  x: number,
  y: number,
  stringCount: number,
): HitPosition | null {
  if (!boundsLookup) return null

  const lookup = boundsLookup as AlphaBoundsLookup

  // ---------------------------------------------------------------------------
  // Step 1: Try alphaTab's own beat-at-position lookup
  // ---------------------------------------------------------------------------
  let beat = lookup.getBeatAtPos(x, y)

  // ---------------------------------------------------------------------------
  // Step 2: Fallback — find nearest beat heuristically
  // ---------------------------------------------------------------------------
  if (!beat) {
    if (!lookup.staffSystems || lookup.staffSystems.length === 0) return null

    const masterBar = findMasterBarAtY(lookup.staffSystems, x, y)
    if (!masterBar) return null

    beat = findNearestBeat(masterBar, x)
    if (!beat) return null
  }

  // ---------------------------------------------------------------------------
  // Step 3: Resolve string index from y-position
  // ---------------------------------------------------------------------------
  const barIndex = beat.voice.bar.index
  const masterBarBounds = lookup.findMasterBarByIndex(barIndex)
  let stringIndex = 1

  let stringLineY = y
  if (masterBarBounds && masterBarBounds.bars.length > 0) {
    // Use the last bar (tab staff) matching TabCanvas convention
    const tabBarBounds =
      masterBarBounds.bars[masterBarBounds.bars.length - 1]
    if (tabBarBounds) {
      const staffBounds = preferredBounds(tabBarBounds)
      stringIndex = deriveStringIndex(staffBounds, y, stringCount)
      // Compute exact Y of the resolved string line (matches deriveStringIndex)
      // string 1 → top (ratio=0), string N → bottom (ratio=1)
      const lineRatio = stringCount > 1 ? (stringIndex - 1) / (stringCount - 1) : 0
      stringLineY = staffBounds.y + lineRatio * staffBounds.h
    }
  }

  return {
    trackIndex: beat.voice.bar.staff.track.index,
    barIndex: beat.voice.bar.index,
    voiceIndex: beat.voice.index,
    beatIndex: beat.index,
    stringIndex,
    stringLineY,
  }
}
