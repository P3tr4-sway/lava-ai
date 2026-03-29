import { cn } from '@/components/ui/utils'

interface SelectionRectProps {
  box: { x: number; y: number; width: number; height: number } | null
  className?: string
}

/**
 * Renders a drag-selection rectangle overlay on the score.
 * Coordinates are relative to the ScoreOverlay container.
 */
export function SelectionRect({ box, className }: SelectionRectProps) {
  if (!box || box.width < 2 || box.height < 2) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute border border-accent bg-accent/10',
        className,
      )}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
      }}
      aria-hidden="true"
    />
  )
}
