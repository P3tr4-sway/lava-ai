import { cn } from '@/components/ui/utils'
import type { OverlayRect } from '../../render/overlayLayer'

interface OverlayCanvasProps {
  rects: OverlayRect[]
  width: number
  height: number
  className?: string
  /** When true, cursor rects use orange (input mode). Default: blue (selection mode). */
  isInsertMode?: boolean
  /**
   * Active voice index — drives cursor color. V2 (index 1) gets green to match
   * Sibelius convention and the visual separation between voices.
   */
  voiceIndex?: number
}

function cursorFill(isInsertMode: boolean, voiceIndex: number): string {
  // Cursor renders as a thin Sibelius-style 2-px line — high opacity required
  // for the line to read at a glance against the score background.
  // Insert mode is the only state where the caret tick is shown; selection-mode
  // cursors fall through to a transparent fill so the per-note tint is the only
  // visible affordance.
  if (voiceIndex === 1) {
    return isInsertMode ? 'rgba(34,197,94,0.9)' : 'transparent'
  }
  return isInsertMode ? 'rgba(255,138,0,0.9)' : 'transparent'
}

/**
 * OverlayCanvas — absolutely positioned SVG drawn over the alphaTab container.
 *
 * Renders cursor, selection, and hover rectangles from OverlayLayer.
 * pointer-events: none so all mouse events pass through to the score below.
 */
export function OverlayCanvas({
  rects,
  width,
  height,
  className,
  isInsertMode = false,
  voiceIndex = 0,
}: OverlayCanvasProps) {
  return (
    <svg
      className={cn('pointer-events-none absolute inset-0', className)}
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {rects.map((rect, i) => {
        if (rect.kind === 'note') {
          // Per-note selection: tint the TAB digit itself by drawing a strong
          // accent fill over the notehead with `mix-blend-mode: multiply`. The
          // digit shows through, but its color shifts toward the accent — so
          // the *number* reads as selected, not a box around it.
          return (
            <rect
              key={i}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={voiceIndex === 1 ? 'rgb(134,239,172)' : 'rgb(255,200,140)'}
              opacity={0.55}
              style={{ mixBlendMode: 'multiply' }}
              rx={2}
            />
          )
        }
        return (
          <rect
            key={i}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={
              rect.kind === 'cursor'
                ? cursorFill(isInsertMode, voiceIndex)
                : rect.kind === 'selection'
                  ? 'color-mix(in srgb, var(--accent) 30%, transparent)'
                  : 'color-mix(in srgb, var(--accent) 15%, transparent)'
            }
            opacity={1}
          />
        )
      })}
    </svg>
  )
}
