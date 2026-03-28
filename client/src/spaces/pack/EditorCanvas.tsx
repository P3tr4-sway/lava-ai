import { useEffect, useRef, useCallback, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { ChordPopover } from './ChordPopover'
import { KeySigPopover } from './KeySigPopover'
import { TextAnnotationInput } from './TextAnnotationInput'

// Minimal MusicXML template for empty scores
const EMPTY_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><rest/><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

interface PopoverState {
  type: 'chord' | 'keySig' | 'text'
  position: { x: number; y: number }
  barIndex: number
}

interface EditorCanvasProps {
  className?: string
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

  const zoom = useEditorStore((s) => s.zoom)
  const toolMode = useEditorStore((s) => s.toolMode)
  const selectBar = useEditorStore((s) => s.selectBar)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  const [popover, setPopover] = useState<PopoverState | null>(null)

  // Initialize OSMD
  useEffect(() => {
    if (!containerRef.current) return
    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: false,
      drawTitle: false,
      drawComposer: false,
      drawCredits: false,
    })
    osmdRef.current = osmd
    osmd.load(EMPTY_MUSICXML).then(() => {
      osmd.render()
    })
    return () => {
      osmdRef.current?.clear()
      osmdRef.current = null
    }
  }, [])

  // Re-render on zoom change
  useEffect(() => {
    if (!osmdRef.current) return
    osmdRef.current.Zoom = zoom / 100
    osmdRef.current.render()
  }, [zoom])

  // Handle click on score
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()

      const osmd = osmdRef.current
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphic = osmd?.GraphicSheet as any
      if (!graphic) {
        clearSelection()
        setPopover(null)
        return
      }

      // MeasureList is GraphicalMeasure[][] — rows per staff line
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const measures: any[][] | undefined = graphic.MeasureList
      if (!measures || measures.length === 0) {
        clearSelection()
        setPopover(null)
        return
      }

      const barIndex = findClickedMeasure(measures, e.clientX, e.clientY, rect)
      if (barIndex < 0) {
        clearSelection()
        setPopover(null)
        return
      }

      if (toolMode === 'pointer') {
        selectBar(barIndex, e.shiftKey)
      } else if (toolMode === 'chord' || toolMode === 'keySig' || toolMode === 'text') {
        selectBar(barIndex)
        setPopover({
          type: toolMode === 'chord' ? 'chord' : toolMode === 'keySig' ? 'keySig' : 'text',
          position: { x: e.clientX - rect.left, y: e.clientY - rect.top - 10 },
          barIndex,
        })
      }
    },
    [toolMode, selectBar, clearSelection],
  )

  const handleChordSelect = useCallback(
    (_chord: { root: string; quality: string }) => {
      // TODO: Apply chord to selected bar in MusicXML via leadSheetStore
      setPopover(null)
    },
    [],
  )

  const handleKeySigSelect = useCallback(
    (keySig: { key: string; mode: 'major' | 'minor'; timeSig: string }) => {
      useLeadSheetStore.getState().setKey(keySig.key)
      useLeadSheetStore.getState().setTimeSignature(keySig.timeSig)
      setPopover(null)
    },
    [],
  )

  const handleTextSubmit = useCallback(
    (_text: string) => {
      // TODO: Attach annotation to selected bar
      setPopover(null)
    },
    [],
  )

  return (
    <div className={cn('relative flex-1 overflow-y-auto bg-surface-0', className)}>
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="min-h-full p-6"
      />

      {popover?.type === 'chord' && (
        <ChordPopover
          position={popover.position}
          onSelect={handleChordSelect}
          onClose={() => setPopover(null)}
        />
      )}
      {popover?.type === 'keySig' && (
        <KeySigPopover
          position={popover.position}
          onSelect={handleKeySigSelect}
          onClose={() => setPopover(null)}
        />
      )}
      {popover?.type === 'text' && (
        <TextAnnotationInput
          position={popover.position}
          onSubmit={handleTextSubmit}
          onCancel={() => setPopover(null)}
        />
      )}
    </div>
  )
}

/**
 * Find which measure index was clicked using the OSMD GraphicalMeasure[][] structure.
 * MeasureList rows correspond to staves; columns correspond to measure indices.
 * We use the first staff row (index 0) since all rows share the same measure count.
 */
function findClickedMeasure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  measures: any[][],
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
): number {
  const firstRow = measures[0]
  if (!firstRow || firstRow.length === 0) return -1

  const totalMeasures = firstRow.length
  const relativeX = clientX - containerRect.left
  const barWidth = containerRect.width / totalMeasures
  const index = Math.floor(relativeX / barWidth)
  return index >= 0 && index < totalMeasures ? index : -1
}
