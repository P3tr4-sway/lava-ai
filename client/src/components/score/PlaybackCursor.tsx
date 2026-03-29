import { cn } from '@/components/ui/utils'
import { usePlaybackCursor } from '@/hooks/usePlaybackCursor'

type GetMeasureBounds = (barIndex: number) => { x: number; y: number; width: number; height: number } | null

interface PlaybackCursorProps {
  getMeasureBounds: GetMeasureBounds
  className?: string
}

/**
 * Renders a vertical bar (left edge of the current bar) as a playback cursor.
 * Positioned absolutely within the ScoreOverlay.
 */
export function PlaybackCursor({ getMeasureBounds, className }: PlaybackCursorProps) {
  const { visible, bounds } = usePlaybackCursor(getMeasureBounds)

  if (!visible || !bounds) return null

  return (
    <div
      className={cn('absolute top-0 w-0.5 bg-accent opacity-70 transition-[left] duration-100', className)}
      style={{
        left: bounds.x,
        top: bounds.y,
        height: bounds.height,
      }}
      aria-hidden="true"
    />
  )
}
