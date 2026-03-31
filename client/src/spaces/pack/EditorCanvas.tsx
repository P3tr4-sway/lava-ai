import { useRef, useMemo, useState, useCallback } from 'react'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { PracticeSurface } from './PracticeSurface'
import { StaffPreview } from './StaffPreview'
import { CursorOverlay } from '@/components/score/CursorOverlay'
import { useCursorEngine } from '@/hooks/useCursorEngine'
import { noteCursorUrl, restCursorUrl } from '@/lib/cursorIcons'
import type { GetMeasureBounds } from '@/lib/cursorMath'

// Upper bound for measure scan — guards against getMeasureBounds never returning null
const MAX_MEASURE_SCAN = 500

interface EditorCanvasProps {
  className?: string
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const viewMode = useEditorStore((state) => state.viewMode)
  const entryDuration = useEditorStore((s) => s.entryDuration)
  const entryMode = useEditorStore((s) => s.entryMode)

  const containerRef = useRef<HTMLDivElement>(null)

  // getMeasureBounds is populated by the child view (StaffPreview or PracticeSurface)
  const getMeasureBoundsRef = useRef<GetMeasureBounds>(() => null)

  // layoutVersion increments when the score re-renders, triggering a snap points rebuild
  const [layoutVersion, setLayoutVersion] = useState(0)
  const onScoreRerender = useCallback(() => setLayoutVersion((v) => v + 1), [])

  // Build snap points from measure bounds
  const snapPoints = useMemo(() => {
    const points: number[] = []
    for (let i = 0; i < MAX_MEASURE_SCAN; i++) {
      const bounds = getMeasureBoundsRef.current(i)
      if (!bounds) break
      points.push(bounds.x)
    }
    return points
  }, [layoutVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const cursor = useCursorEngine(
    containerRef,
    useCallback((i: number) => getMeasureBoundsRef.current(i), []),
    snapPoints,
  )

  // CSS cursor for note entry mode
  const cursorStyle: React.CSSProperties | undefined =
    cursor.cursorMode === 'noteEntry'
      ? { cursor: entryMode === 'rest' ? restCursorUrl() : noteCursorUrl(entryDuration) }
      : cursor.cursorMode === 'select' || cursor.cursorMode === 'playback'
        ? { cursor: 'none' }
        : undefined

  return (
    <div
      ref={containerRef}
      className={cn('relative grid min-h-0 w-full flex-1 gap-5 overflow-auto px-5 pb-24 pt-4', className)}
      style={cursorStyle}
      onMouseMove={cursor.onMouseMove}
      onMouseLeave={cursor.onMouseLeave}
    >
      {viewMode === 'staff' && (
        <StaffPreview
          className="min-h-0"
          getMeasureBoundsRef={getMeasureBoundsRef}
          onScoreRerender={onScoreRerender}
        />
      )}
      {viewMode === 'tab' && (
        <PracticeSurface
          className="min-h-0"
          getMeasureBoundsRef={getMeasureBoundsRef}
          onScoreRerender={onScoreRerender}
        />
      )}
      {viewMode === 'leadSheet' && (
        <StaffPreview
          className="min-h-0"
          getMeasureBoundsRef={getMeasureBoundsRef}
          onScoreRerender={onScoreRerender}
        />
      )}

      <CursorOverlay
        cursorMode={cursor.cursorMode}
        displayX={cursor.displayX}
        displayY={cursor.displayY}
        isSnapped={cursor.isSnapped}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  )
}
