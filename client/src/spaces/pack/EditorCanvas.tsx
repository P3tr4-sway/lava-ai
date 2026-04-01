import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { PracticeSurface } from './PracticeSurface'
import { ScoreSidebarToolbar } from './ScoreSidebarToolbar'
import { StaffPreview } from './StaffPreview'
import { CursorOverlay } from '@/components/score/CursorOverlay'
import { useCursorEngine } from '@/hooks/useCursorEngine'
import { useRangeSelect } from '@/hooks/useRangeSelect'
import { noteCursorUrl, restCursorUrl } from '@/lib/cursorIcons'
import type { GetMeasureBounds } from '@/lib/cursorMath'

// Upper bound for measure scan — guards against getMeasureBounds never returning null
const MAX_MEASURE_SCAN = 500

interface EditorCanvasProps {
  className?: string
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const viewMode = useEditorStore((state) => state.viewMode)
  const editorMode = useEditorStore((state) => state.editorMode)
  const entryDuration = useEditorStore((s) => s.entryDuration)
  const entryMode = useEditorStore((s) => s.entryMode)

  const containerRef = useRef<HTMLDivElement>(null)

  // getMeasureBounds is populated by the child view (StaffPreview or PracticeSurface)
  const getMeasureBoundsRef = useRef<GetMeasureBounds>(() => null)

  // layoutVersion increments when the score re-renders, triggering a snap points rebuild
  const [layoutVersion, setLayoutVersion] = useState(0)
  const onScoreRerender = useCallback(() => setLayoutVersion((v) => v + 1), [])

  // Rebuild snap points when the container is resized (window resize, sidebar open/close, zoom change)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setLayoutVersion((v) => v + 1)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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

  // Range select for staff/leadSheet view (tab view handles it internally in EditSurface)
  const getMeasureBoundsCb = useCallback((i: number) => getMeasureBoundsRef.current(i), [])
  const rangeSelect = useRangeSelect(containerRef, getMeasureBoundsCb)
  const isStaffView = viewMode === 'staff' || viewMode === 'leadSheet'
  const cursorOnMouseMove = cursor.onMouseMove
  const rangeSelectOnMouseMove = rangeSelect.onMouseMove

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      cursorOnMouseMove(e)
      if (isStaffView) rangeSelectOnMouseMove(e)
    },
    [cursorOnMouseMove, rangeSelectOnMouseMove, isStaffView],
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
      className={cn(
        'relative grid min-h-0 w-full flex-1 gap-5 overflow-auto px-5 pb-24 pt-4',
        editorMode === 'fineEdit' && 'pl-24',
        className,
      )}
      style={cursorStyle}
      onMouseDown={isStaffView ? rangeSelect.onMouseDown : undefined}
      onMouseMove={handleMouseMove}
      onMouseUp={isStaffView ? rangeSelect.onMouseUp : undefined}
      onMouseLeave={cursor.onMouseLeave}
    >
      {viewMode === 'staff' && (
        <StaffPreview
          className="min-h-0"
          getMeasureBoundsRef={getMeasureBoundsRef}
          editorContainerRef={containerRef}
          onScoreRerender={onScoreRerender}
        />
      )}
      {viewMode === 'tab' && (
        <PracticeSurface
          className="min-h-0"
          getMeasureBoundsRef={getMeasureBoundsRef}
          editorContainerRef={containerRef}
          onScoreRerender={onScoreRerender}
        />
      )}
      {viewMode === 'leadSheet' && (
        <StaffPreview
          className="min-h-0"
          getMeasureBoundsRef={getMeasureBoundsRef}
          editorContainerRef={containerRef}
          onScoreRerender={onScoreRerender}
        />
      )}

      {isStaffView && rangeSelect.isDragging && rangeSelect.selectionBox && (
        <div
          className="absolute pointer-events-none border border-accent bg-accent/10 rounded"
          style={{
            left: rangeSelect.selectionBox.x,
            top: rangeSelect.selectionBox.y,
            width: rangeSelect.selectionBox.width,
            height: rangeSelect.selectionBox.height,
          }}
        />
      )}

      <ScoreSidebarToolbar />

      <CursorOverlay
        cursorMode={cursor.cursorMode}
        displayX={cursor.displayX}
        displayY={cursor.displayY}
        overlaySize={cursor.overlaySize}
        isSnapped={cursor.isSnapped}
        className="pointer-events-none"
      />
    </div>
  )
}
