/** Bounds of a single measure returned by getMeasureBounds. */
export type MeasureBounds = { x: number; y: number; width: number; height: number }

/** Function that returns the bounding box of measure barIndex, or null if out of range. */
export type GetMeasureBounds = (barIndex: number) => MeasureBounds | null

/** Linear interpolation between a and b by factor t (0–1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Computes the snapped x target given raw mouse x and an array of snap-point x values.
 * Returns rawX if no snap point is within snapRadius.
 * Uses elastic pull: pull strength increases as cursor approaches the snap point.
 */
export function computeSnapTarget(
  rawX: number,
  snapPoints: number[],
  snapRadius: number,
  snapStrength: number,
): number {
  if (snapPoints.length === 0) return rawX

  // Find the closest snap point within radius
  let nearestSnap: number | null = null
  let nearestDist = Infinity

  for (const sx of snapPoints) {
    const dist = Math.abs(rawX - sx)
    if (dist < nearestDist && dist < snapRadius) {
      nearestDist = dist
      nearestSnap = sx
    }
  }

  if (nearestSnap === null) return rawX

  const pull = (1 - nearestDist / snapRadius) * snapStrength
  return rawX + (nearestSnap - rawX) * pull
}

/** Returns true if displayX is within threshold of any snap point. */
export function isSnapped(displayX: number, snapPoints: number[], threshold: number): boolean {
  return snapPoints.some((sx) => Math.abs(displayX - sx) <= threshold)
}

export type CursorMode = 'select' | 'noteEntry' | 'playback' | 'hidden'

export type ActiveToolGroup = 'selection' | 'note' | 'rest' | 'notation' | 'measure' | 'playback'
export type PlaybackState = 'stopped' | 'playing' | 'paused'

/** Derives the cursor mode from toolbar and playback state. */
export function deriveCursorMode(
  activeToolGroup: ActiveToolGroup,
  playbackState: PlaybackState,
): CursorMode {
  if (playbackState === 'playing') return 'playback'
  if (activeToolGroup === 'note') return 'noteEntry'
  if (activeToolGroup === 'selection') return 'select'
  return 'hidden'
}
