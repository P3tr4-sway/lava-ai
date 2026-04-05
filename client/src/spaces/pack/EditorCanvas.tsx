import { useRef, useState, useCallback, useEffect } from 'react'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { PracticeSurface } from './PracticeSurface'
import { useRangeSelect } from '@/hooks/useRangeSelect'
import { noteCursorUrl, restCursorUrl } from '@/lib/cursorIcons'
import type { GetMeasureBounds } from '@/lib/cursorMath'

interface EditorCanvasProps {
  className?: string
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const viewMode = useEditorStore((state) => state.viewMode)
  const editorMode = useEditorStore((state) => state.editorMode)
  const entryDuration = useEditorStore((s) => s.entryDuration)
  const entryMode = useEditorStore((s) => s.entryMode)
  const activeToolGroup = useEditorStore((s) => s.activeToolGroup)

  const containerRef = useRef<HTMLDivElement>(null)

  // getMeasureBounds is populated by the child PracticeSurface via TabCanvas
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

  // Range select for staff/leadSheet view
  const getMeasureBoundsCb = useCallback((i: number) => getMeasureBoundsRef.current(i), [])
  const rangeSelect = useRangeSelect(containerRef, getMeasureBoundsCb)
  const isStaffView = viewMode === 'staff' || viewMode === 'leadSheet'

  // CSS cursor: custom icon in note-entry mode, default otherwise (alphaTab handles playback cursor)
  const isNoteEntry = editorMode === 'fineEdit' && (activeToolGroup === 'note' || activeToolGroup === 'rest')
  const cursorStyle: React.CSSProperties | undefined = isNoteEntry
    ? { cursor: entryMode === 'rest' ? restCursorUrl() : noteCursorUrl(entryDuration) }
    : undefined

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative grid min-h-0 w-full flex-1 gap-5 overflow-auto px-5 pb-32 pt-4',
        editorMode === 'fineEdit' && 'pl-24',
        className,
      )}
      style={cursorStyle}
      onMouseDown={isStaffView ? rangeSelect.onMouseDown : undefined}
      onMouseMove={isStaffView ? rangeSelect.onMouseMove : undefined}
      onMouseUp={isStaffView ? rangeSelect.onMouseUp : undefined}
    >
      <PracticeSurface
        className="min-h-0"
        viewMode={viewMode}
        getMeasureBoundsRef={getMeasureBoundsRef}
        editorContainerRef={containerRef}
        onScoreRerender={onScoreRerender}
      />

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
    </div>
  )
}
