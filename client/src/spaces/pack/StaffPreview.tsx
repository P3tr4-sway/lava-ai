import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { cn } from '@/components/ui/utils'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import type { GetMeasureBounds } from '@/lib/cursorMath'

interface StaffPreviewProps {
  className?: string
  getMeasureBoundsRef?: React.MutableRefObject<GetMeasureBounds>
  /** EditorCanvas containerRef — used to compute bounds in EditorCanvas content space. */
  editorContainerRef?: React.RefObject<HTMLElement | null>
  onScoreRerender?: () => void
}

function assignScoreNoteIds(container: HTMLElement, noteIds: string[]) {
  const noteEls = Array.from(container.querySelectorAll<SVGGElement>('.vf-stavenote'))
  noteEls.forEach((noteEl, index) => {
    const noteId = noteIds[index]
    if (!noteId) return
    noteEl.dataset.scoreNoteId = noteId
  })
}

export function StaffPreview({ className, getMeasureBoundsRef, editorContainerRef, onScoreRerender }: StaffPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

  // Derive measure bounds from OSMD DOM elements (.vf-measure are 1-indexed by OSMD).
  // Returns coordinates in EditorCanvas content space so CursorOverlay aligns correctly.
  const getMeasureBounds = useCallback<GetMeasureBounds>((barIndex: number) => {
    const osmdContainer = containerRef.current
    const editorEl = editorContainerRef?.current
    if (!osmdContainer || !editorEl) return null
    const el = osmdContainer.querySelector<SVGGElement>(`.vf-measure[id="${barIndex + 1}"]`)
    if (!el) return null
    const svgRoot = el.ownerSVGElement
    if (!svgRoot) return null
    // getBBox gives position in SVG coordinate space; convert to EditorCanvas content space
    try {
      const bbox = el.getBBox()
      const svgRect = svgRoot.getBoundingClientRect()
      const editorRect = editorEl.getBoundingClientRect()
      const scaleX = svgRect.width / (svgRoot.viewBox.baseVal.width || svgRect.width)
      const scaleY = svgRect.height / (svgRoot.viewBox.baseVal.height || svgRect.height)
      return {
        x: svgRect.left - editorRect.left + editorEl.scrollLeft + bbox.x * scaleX,
        y: svgRect.top - editorRect.top + editorEl.scrollTop + bbox.y * scaleY,
        width: bbox.width * scaleX,
        height: bbox.height * scaleY,
      }
    } catch {
      return null
    }
  }, [editorContainerRef])

  // Keep getMeasureBoundsRef current whenever the callback changes identity
  useEffect(() => {
    if (getMeasureBoundsRef) {
      getMeasureBoundsRef.current = getMeasureBounds
    }
  }, [getMeasureBoundsRef, getMeasureBounds])
  const exportCacheXml = useScoreDocumentStore((state) => state.exportCacheXml)
  const document = useScoreDocumentStore((state) => state.document)
  const selectedBars = useEditorStore((state) => state.selectedBars)
  const selectedNoteIds = useEditorStore((state) => state.selectedNoteIds)
  const selectBar = useEditorStore((state) => state.selectBar)
  const selectNoteById = useEditorStore((state) => state.selectNoteById)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const zoom = useEditorStore((state) => state.zoom)
  const showChordDiagrams = useEditorStore((state) => state.showChordDiagrams)
  const chordDiagramGlobal = useEditorStore((state) => state.chordDiagramGlobal)
  const currentBar = useAudioStore((state) => state.currentBar)

  const orderedNoteIds = useMemo(
    () =>
      (document.tracks[0]?.notes ?? [])
        .slice()
        .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
        .map((note) => note.id),
    [document],
  )

  const chordOverlays = useMemo(() => {
    if (!showChordDiagrams || chordDiagramGlobal === 'hidden') return []
    return document.measures.flatMap((measure) => {
      const symbol = measure.harmony[0]?.symbol
      if (!symbol) return []
      return [{ measureIndex: measure.index, symbol }]
    })
  }, [document.measures, showChordDiagrams, chordDiagramGlobal])

  useEffect(() => {
    if (!containerRef.current) return
    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawCredits: false,
      drawComposer: false,
      drawTitle: false,
    })
    osmd.EngravingRules.RenderMultipleRestMeasures = false
    osmd.EngravingRules.AutoGenerateMultipleRestMeasuresFromRestMeasures = false
    osmdRef.current = osmd
    return () => {
      osmd.clear()
      osmdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!osmdRef.current || !exportCacheXml) return
    osmdRef.current.EngravingRules.RenderMultipleRestMeasures = false
    osmdRef.current.EngravingRules.AutoGenerateMultipleRestMeasuresFromRestMeasures = false
    osmdRef.current.load(exportCacheXml).then(() => {
      if (!osmdRef.current || !containerRef.current) return
      osmdRef.current.Zoom = zoom / 100
      osmdRef.current.render()
      assignScoreNoteIds(containerRef.current, orderedNoteIds)
      syncHighlights()
      onScoreRerender?.()
    })
    // syncHighlights uses latest store state via DOM query after render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportCacheXml, orderedNoteIds, zoom])

  useEffect(() => {
    syncHighlights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBars, selectedNoteIds, currentBar])

  function syncHighlights() {
    const container = containerRef.current
    if (!container) return
    container.querySelectorAll('.lava-bar-selected, .lava-note-selected, .lava-bar-playing').forEach((el) => {
      el.classList.remove('lava-bar-selected', 'lava-note-selected', 'lava-bar-playing')
    })
    selectedBars.forEach((barIndex) => {
      container.querySelector(`.vf-measure[id="${barIndex + 1}"]`)?.classList.add('lava-bar-selected')
    })
    selectedNoteIds.forEach((noteId) => {
      container.querySelector(`[data-score-note-id="${noteId}"]`)?.classList.add('lava-note-selected')
    })
    if (currentBar >= 0) {
      container.querySelector(`.vf-measure[id="${currentBar + 1}"]`)?.classList.add('lava-bar-playing')
    }
  }

  function clearHoverHighlights() {
    const container = containerRef.current
    if (!container) return
    container.querySelectorAll('.lava-bar-hover, .lava-note-hover').forEach((el) => {
      el.classList.remove('lava-bar-hover', 'lava-note-hover')
    })
  }

  return (
    <div className={cn('relative overflow-auto px-5 pb-8 pt-4', className)}>
      {chordOverlays.length > 0 && (chordDiagramGlobal === 'top' || chordDiagramGlobal === 'both') && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2">
          {chordOverlays.map((entry) => (
            <span key={`top-${entry.measureIndex}`} className="text-xs font-semibold text-text-primary">
              {entry.symbol}
            </span>
          ))}
        </div>
      )}
      <div
        className="h-full"
        onMouseMove={(event) => {
          clearHoverHighlights()
          const target = event.target as HTMLElement
          const noteEl = target.closest<SVGGElement>('.vf-stavenote')
          if (noteEl) {
            noteEl.classList.add('lava-note-hover')
            return
          }
          target.closest<SVGGElement>('.vf-measure')?.classList.add('lava-bar-hover')
        }}
        onMouseLeave={clearHoverHighlights}
        onClick={(event) => {
          const target = event.target as HTMLElement
          const noteEl = target.closest<SVGGElement>('.vf-stavenote')
          const measureEl = target.closest<SVGGElement>('.vf-measure')
          const measureId = measureEl?.id ? parseInt(measureEl.id, 10) - 1 : null

          if (noteEl?.dataset.scoreNoteId) {
            selectNoteById(noteEl.dataset.scoreNoteId, event.shiftKey)
            return
          }

          if (measureId !== null && Number.isFinite(measureId)) {
            selectBar(measureId, event.shiftKey)
            return
          }

          clearSelection()
        }}
      >
        <div ref={containerRef} className="score-paper-bg min-h-full" />
      </div>
      {chordOverlays.length > 0 && (chordDiagramGlobal === 'bottom' || chordDiagramGlobal === 'both') && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
          {chordOverlays.map((entry) => (
            <span key={`bottom-${entry.measureIndex}`} className="text-xs font-semibold text-text-primary">
              {entry.symbol}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
