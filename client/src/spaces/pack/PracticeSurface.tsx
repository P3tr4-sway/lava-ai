import { TabCanvas } from './TabCanvas'
import type { GetMeasureBounds } from '@/lib/cursorMath'

interface PracticeSurfaceProps {
  className?: string
  compact?: boolean
  getMeasureBoundsRef?: React.MutableRefObject<GetMeasureBounds>
  onScoreRerender?: () => void
}

export function PracticeSurface({ className, compact = false, getMeasureBoundsRef, onScoreRerender }: PracticeSurfaceProps) {
  return (
    <TabCanvas
      className={className}
      compact={compact}
      getMeasureBoundsRef={getMeasureBoundsRef}
      onScoreRerender={onScoreRerender}
    />
  )
}
