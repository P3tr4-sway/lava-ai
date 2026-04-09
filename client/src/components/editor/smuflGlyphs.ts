/**
 * Note: Bravura font does NOT work for CSS @font-face rendering.
 * It only renders via alphaTab's canvas/SVG path engine.
 * This file now only exports text-based helpers for dynamics display.
 */

import type { DynamicsValue } from '@/editor/ast/types'

/** Display string for a dynamic marking (italic-styled in the UI) */
export function dynamicLabel(value: DynamicsValue): string {
  return value
}
