import { useEffect, useMemo, useRef } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { cn } from '@/components/ui/utils'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

interface StaffPreviewProps {
  className?: string
}

function assignScoreNoteIds(container: HTMLElement, noteIds: string[]) {
  const noteEls = Array.from(container.querySelectorAll<SVGGElement>('.vf-stavenote'))
  noteEls.forEach((noteEl, index) => {
    const noteId = noteIds[index]
    if (!noteId) return
    noteEl.dataset.scoreNoteId = noteId
  })
}

export function StaffPreview({ className }: StaffPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const exportCacheXml = useScoreDocumentStore((state) => state.exportCacheXml)
  const document = useScoreDocumentStore((state) => state.document)
  const selectedBars = useEditorStore((state) => state.selectedBars)
  const selectedNoteIds = useEditorStore((state) => state.selectedNoteIds)
  const selectBar = useEditorStore((state) => state.selectBar)
  const selectNoteById = useEditorStore((state) => state.selectNoteById)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const selectionScope = useEditorStore((state) => state.selectionScope)
  const zoom = useEditorStore((state) => state.zoom)
  const currentBar = useAudioStore((state) => state.currentBar)

  const orderedNoteIds = useMemo(
    () =>
      (document.tracks[0]?.notes ?? [])
        .slice()
        .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
        .map((note) => note.id),
    [document],
  )

  useEffect(() => {
    if (!containerRef.current) return
    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawCredits: false,
      drawComposer: false,
      drawTitle: false,
    })
    osmdRef.current = osmd
    return () => {
      osmd.clear()
      osmdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!osmdRef.current || !exportCacheXml) return
    osmdRef.current.load(exportCacheXml).then(() => {
      if (!osmdRef.current || !containerRef.current) return
      osmdRef.current.Zoom = zoom / 100
      osmdRef.current.render()
      assignScoreNoteIds(containerRef.current, orderedNoteIds)
      syncHighlights()
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
    <div
      className={cn('h-full overflow-auto rounded-2xl border border-border bg-surface-1 p-4', className)}
      onMouseMove={(event) => {
        clearHoverHighlights()
        const target = event.target as HTMLElement
        if (selectionScope === 'note') {
          target.closest<SVGGElement>('.vf-stavenote')?.classList.add('lava-note-hover')
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

        if (selectionScope === 'note' && noteEl?.dataset.scoreNoteId) {
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
      <div ref={containerRef} className="min-h-full" />
    </div>
  )
}
