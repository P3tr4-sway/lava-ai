import { cn } from '@/components/ui/utils'
import type { OverlayRect } from '../../render/overlayLayer'

interface OverlayCanvasProps {
  rects: OverlayRect[]
  width: number
  height: number
  className?: string
  /** CSS color value for cursor rects. Defaults to 'var(--accent)'. */
  cursorColor?: string
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
  cursorColor = 'var(--accent)',
}: OverlayCanvasProps) {
  return (
    <svg
      className={cn('pointer-events-none absolute inset-0', className)}
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {rects.map((rect, i) => (
        <rect
          key={i}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          className={rect.kind === 'cursor' ? 'lava-cursor-blink' : undefined}
          fill={
            rect.kind === 'cursor'
              ? cursorColor
              : rect.kind === 'selection'
                ? 'color-mix(in srgb, var(--accent) 30%, transparent)'
                : 'color-mix(in srgb, var(--accent) 15%, transparent)'
          }
          opacity={rect.kind === 'cursor' ? 1 : 0.5}
        />
      ))}
    </svg>
  )
}
