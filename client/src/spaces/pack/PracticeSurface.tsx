import { TabCanvas } from './TabCanvas'
import type { GetMeasureBounds } from '@/lib/cursorMath'

interface PracticeSurfaceProps {
  className?: string
  compact?: boolean
  getMeasureBoundsRef?: React.MutableRefObject<GetMeasureBounds>
  /** EditorCanvas containerRef — forwarded to TabCanvas for EditorCanvas-space bounds. */
  editorContainerRef?: React.RefObject<HTMLElement | null>
  onScoreRerender?: () => void
}

export function PracticeSurface({ className, compact = false, getMeasureBoundsRef, editorContainerRef, onScoreRerender }: PracticeSurfaceProps) {
  return (
    <TabCanvas
      className={className}
      compact={compact}
      getMeasureBoundsRef={getMeasureBoundsRef}
      editorContainerRef={editorContainerRef}
      onScoreRerender={onScoreRerender}
    />
  )
}
