import { TabCanvas } from './TabCanvas'
import type { GetMeasureBounds } from '@/lib/cursorMath'

interface PracticeSurfaceProps {
  className?: string
  compact?: boolean
  viewMode?: 'tab' | 'staff' | 'leadSheet' | 'split'
  getMeasureBoundsRef?: React.MutableRefObject<GetMeasureBounds>
  /** EditorCanvas containerRef — forwarded to TabCanvas for EditorCanvas-space bounds. */
  editorContainerRef?: React.RefObject<HTMLElement | null>
  onScoreRerender?: () => void
}

export function PracticeSurface({ className, compact = false, viewMode, getMeasureBoundsRef, editorContainerRef, onScoreRerender }: PracticeSurfaceProps) {
  return (
    <TabCanvas
      className={className}
      compact={compact}
      viewMode={viewMode}
      getMeasureBoundsRef={getMeasureBoundsRef}
      editorContainerRef={editorContainerRef}
      onScoreRerender={onScoreRerender}
    />
  )
}
