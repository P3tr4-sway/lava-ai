/**
 * BendCurveEditor — pure-SVG visual editor for bend / whammy control points.
 *
 * Coordinate system matches AlphaTex:
 *  - `position` ∈ [0, 60]   — horizontal timeline, 30 = middle of note
 *  - `value`    ∈ [0, 12]   — vertical pitch (quarter-tones) for bend
 *                ∈ [-12,12] — for whammy (supports down-whammy / dive)
 *
 * No third-party drawing libs: React pointer events + SVG. ~150 LOC.
 *
 * Usage:
 *   <BendCurveEditor kind="bend"   points={note.bend   ?? []} onChange={...} />
 *   <BendCurveEditor kind="whammy" points={beat.whammy ?? []} onChange={...} />
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/components/ui/utils'
import type { BendPoint } from '@/editor/ast/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BEND_PRESETS: Record<string, BendPoint[]> = {
  full: [{ position: 0, value: 0 }, { position: 15, value: 8 }, { position: 60, value: 8 }],
  half: [{ position: 0, value: 0 }, { position: 15, value: 4 }, { position: 60, value: 4 }],
  prebend: [{ position: 0, value: 8 }, { position: 60, value: 8 }],
  release: [
    { position: 0, value: 0 },
    { position: 15, value: 8 },
    { position: 45, value: 8 },
    { position: 60, value: 0 },
  ],
  vibrato: [
    { position: 0, value: 0 },
    { position: 15, value: 8 },
    { position: 30, value: 6 },
    { position: 45, value: 8 },
    { position: 60, value: 8 },
  ],
}

export const WHAMMY_PRESETS: Record<string, BendPoint[]> = {
  dive: [{ position: 0, value: 0 }, { position: 30, value: -8 }, { position: 60, value: 0 }],
  diveHold: [{ position: 0, value: 0 }, { position: 15, value: -8 }, { position: 60, value: -8 }],
  up: [{ position: 0, value: 0 }, { position: 30, value: 8 }, { position: 60, value: 0 }],
  dip: [
    { position: 0, value: 0 },
    { position: 20, value: -4 },
    { position: 40, value: -4 },
    { position: 60, value: 0 },
  ],
}

const X_MAX = 60
const PAD = 8 // inner SVG padding so control points aren't clipped

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  points: BendPoint[]
  onChange: (next: BendPoint[]) => void
  kind: 'bend' | 'whammy'
  width?: number
  height?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Sort by position, stable for ties. Mutates input. */
function sortPoints(arr: BendPoint[]): BendPoint[] {
  return [...arr].sort((a, b) => a.position - b.position)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BendCurveEditor({
  points,
  onChange,
  kind,
  width = 240,
  height = 120,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  // Y axis range differs for whammy (bipolar)
  const yMin = kind === 'whammy' ? -12 : 0
  const yMax = 12

  // Coordinate transforms: data space (position 0-60, value yMin-yMax) <-> pixels
  const plotW = width - PAD * 2
  const plotH = height - PAD * 2

  const toPx = useCallback(
    (p: BendPoint): { x: number; y: number } => ({
      x: PAD + (p.position / X_MAX) * plotW,
      y: PAD + ((yMax - p.value) / (yMax - yMin)) * plotH,
    }),
    [plotW, plotH, yMax, yMin],
  )

  const toData = useCallback(
    (px: number, py: number): BendPoint => {
      const position = clamp(Math.round(((px - PAD) / plotW) * X_MAX), 0, X_MAX)
      const rawValue = yMax - ((py - PAD) / plotH) * (yMax - yMin)
      const value = clamp(Math.round(rawValue), yMin, yMax)
      return { position, value }
    },
    [plotW, plotH, yMax, yMin],
  )

  const sorted = useMemo(() => sortPoints(points), [points])

  // ---------------------------------------------------------------------------
  // Pointer handlers
  // ---------------------------------------------------------------------------

  const getSvgPoint = useCallback((evt: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }, [])

  const handlePointPointerDown = (idx: number) => (evt: React.PointerEvent<SVGCircleElement>) => {
    if (evt.button === 2) return // right-click handled separately
    evt.stopPropagation()
    ;(evt.target as Element).setPointerCapture(evt.pointerId)
    setDraggingIndex(idx)
  }

  const handlePointerMove = (evt: React.PointerEvent) => {
    if (draggingIndex === null) return
    const p = getSvgPoint(evt)
    if (!p) return
    const next = toData(p.x, p.y)
    // Do NOT re-sort while dragging — that would shuffle the array and make
    // draggingIndex point at the wrong element once the drag crosses a
    // neighbor. Sort on pointer-up instead.
    const updated = sorted.map((pt, i) => (i === draggingIndex ? next : pt))
    onChange(updated)
  }

  const handlePointerUp = (evt: React.PointerEvent) => {
    if (draggingIndex !== null) {
      ;(evt.target as Element).releasePointerCapture?.(evt.pointerId)
      setDraggingIndex(null)
      // Final sort so downstream consumers (AlphaTex print) see monotonic
      // position order.
      onChange(sortPoints(points))
    }
  }

  const handleCanvasPointerDown = (evt: React.PointerEvent<SVGSVGElement>) => {
    // Clicking on empty canvas inserts a point
    if (evt.target === svgRef.current || (evt.target as Element).tagName === 'polyline') {
      const p = getSvgPoint(evt)
      if (!p) return
      const pt = toData(p.x, p.y)
      onChange(sortPoints([...sorted, pt]))
    }
  }

  const handlePointContextMenu = (idx: number) => (evt: React.MouseEvent) => {
    evt.preventDefault()
    onChange(sorted.filter((_, i) => i !== idx))
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const polylinePoints = useMemo(
    () =>
      sorted
        .map((pt) => {
          const px = toPx(pt)
          return `${px.x},${px.y}`
        })
        .join(' '),
    [sorted, toPx],
  )

  // Y grid lines: quarter-tone steps (4 / 8 / 12 and their negatives for whammy)
  const yGridValues =
    kind === 'whammy' ? [-12, -8, -4, 0, 4, 8, 12] : [0, 4, 8, 12]
  const xGridValues = [0, 15, 30, 45, 60]

  const zeroLineY = toPx({ position: 0, value: 0 }).y

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={`${kind === 'whammy' ? 'Whammy' : 'Bend'} curve editor`}
        className="rounded-md border border-border bg-surface-1 touch-none select-none"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Grid: vertical (time) */}
        {xGridValues.map((x) => {
          const px = toPx({ position: x, value: 0 }).x
          return (
            <line
              key={`xg-${x}`}
              x1={px}
              x2={px}
              y1={PAD}
              y2={height - PAD}
              className="stroke-border"
              strokeWidth={0.5}
              strokeDasharray="2 3"
            />
          )
        })}
        {/* Grid: horizontal (pitch) */}
        {yGridValues.map((v) => {
          const py = toPx({ position: 0, value: v }).y
          return (
            <line
              key={`yg-${v}`}
              x1={PAD}
              x2={width - PAD}
              y1={py}
              y2={py}
              className={cn(v === 0 ? 'stroke-text-muted' : 'stroke-border')}
              strokeWidth={v === 0 ? 0.8 : 0.5}
              strokeDasharray={v === 0 ? undefined : '2 3'}
            />
          )
        })}
        {/* Zero reference line (whammy only) */}
        {kind === 'whammy' && (
          <line
            x1={PAD}
            x2={width - PAD}
            y1={zeroLineY}
            y2={zeroLineY}
            className="stroke-text-muted"
            strokeWidth={0.8}
          />
        )}
        {/* Curve */}
        {sorted.length >= 2 && (
          <polyline
            points={polylinePoints}
            fill="none"
            className={cn(kind === 'whammy' ? 'stroke-warning' : 'stroke-accent')}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {/* Control points.
            IMPORTANT: key must be STABLE during a drag. Including position /
            value in the key would force React to unmount+remount the circle
            on every pointermove, which would release setPointerCapture and
            break the drag after the first move. */}
        {sorted.map((pt, i) => {
          const px = toPx(pt)
          return (
            <circle
              key={i}
              cx={px.x}
              cy={px.y}
              r={5}
              className={cn(
                'cursor-grab',
                kind === 'whammy' ? 'fill-warning' : 'fill-accent',
                draggingIndex === i && 'cursor-grabbing',
              )}
              stroke="white"
              strokeWidth={1}
              onPointerDown={handlePointPointerDown(i)}
              onContextMenu={handlePointContextMenu(i)}
            />
          )
        })}
      </svg>
      <p className="text-[10px] text-text-muted leading-tight">
        Click empty area to add a point · drag to move · right-click to remove
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preset helpers — exported so PropertyPanel can render preset buttons
// ---------------------------------------------------------------------------

export function getPresetsForKind(kind: 'bend' | 'whammy'): Array<{
  key: string
  label: string
  points: BendPoint[]
}> {
  if (kind === 'whammy') {
    return [
      { key: 'dive', label: 'Dive', points: WHAMMY_PRESETS.dive },
      { key: 'diveHold', label: 'Dive & Hold', points: WHAMMY_PRESETS.diveHold },
      { key: 'up', label: 'Up', points: WHAMMY_PRESETS.up },
      { key: 'dip', label: 'Dip', points: WHAMMY_PRESETS.dip },
    ]
  }
  return [
    { key: 'full', label: 'Full', points: BEND_PRESETS.full },
    { key: 'half', label: 'Half', points: BEND_PRESETS.half },
    { key: 'prebend', label: 'Pre-Bend', points: BEND_PRESETS.prebend },
    { key: 'release', label: 'Release', points: BEND_PRESETS.release },
    { key: 'vibrato', label: 'Vibrato', points: BEND_PRESETS.vibrato },
  ]
}
