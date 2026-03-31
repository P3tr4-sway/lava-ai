import { TabCanvas } from './TabCanvas'

type GetMeasureBounds = (barIndex: number) => { x: number; y: number; width: number; height: number } | null

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
