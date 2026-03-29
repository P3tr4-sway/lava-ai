import { useEffect, useRef, useCallback, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useScoreSync } from '@/hooks/useScoreSync'
import { ScoreOverlay } from '@/components/score/ScoreOverlay'
import { PlaybackCursor } from '@/components/score/PlaybackCursor'
import { SelectionRect } from '@/components/score/SelectionRect'
import { ContextPill, type ContextPillSelectionType } from '@/components/score/ContextPill'
import { useRangeSelect } from '@/hooks/useRangeSelect'
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
  const selectNote = useEditorStore((s) => s.selectNote)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const selectedBars = useEditorStore((s) => s.selectedBars)
  const selectedNotes = useEditorStore((s) => s.selectedNotes)

  const { syncHighlights, getMeasureBounds, getNoteBounds } = useScoreSync(containerRef)
  const { selectionBox, onMouseDown, onMouseMove, onMouseUp } = useRangeSelect(
    containerRef,
    getMeasureBounds,
  )

  const [popover, setPopover] = useState<PopoverState | null>(null)

  const musicXml = useLeadSheetStore((s) => s.musicXml)

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
    const initialXml = useLeadSheetStore.getState().musicXml ?? EMPTY_MUSICXML
    osmd.load(initialXml).then(() => {
      osmd.render()
      syncHighlights()
    })
    return () => {
      osmdRef.current?.clear()
      osmdRef.current = null
    }
  // syncHighlights is stable (useCallback with stable deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload score when musicXml from store changes
  useEffect(() => {
    if (!musicXml || !osmdRef.current) return
    osmdRef.current.load(musicXml).then(() => {
      if (osmdRef.current) {
        osmdRef.current.Zoom = zoom / 100
        osmdRef.current.render()
        syncHighlights()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXml])

  // Re-render on zoom change
  useEffect(() => {
    if (!osmdRef.current) return
    osmdRef.current.Zoom = zoom / 100
    osmdRef.current.render()
    syncHighlights()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  // Handle click on score
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Skip click logic for range tool — selection committed on mouseUp
      if (toolMode === 'range') return
      if (!containerRef.current) return

      const hit = findClickedElement(e.clientX, e.clientY)
      if (!hit) {
        clearSelection()
        setPopover(null)
        return
      }

      if (hit.type === 'note' && toolMode === 'pointer') {
        selectNote(hit.barIndex, hit.noteIndex, e.shiftKey)
        syncHighlights()
        return
      }

      const barIndex = hit.barIndex
      if (toolMode === 'pointer') {
        selectBar(barIndex, e.shiftKey)
        syncHighlights()
      } else if (toolMode === 'chord' || toolMode === 'keySig' || toolMode === 'text') {
        const rect = containerRef.current.getBoundingClientRect()
        selectBar(barIndex)
        syncHighlights()
        setPopover({
          type: toolMode === 'chord' ? 'chord' : toolMode === 'keySig' ? 'keySig' : 'text',
          position: { x: e.clientX - rect.left, y: e.clientY - rect.top - 10 },
          barIndex,
        })
      }
    },
    [toolMode, selectBar, selectNote, clearSelection, syncHighlights],
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
      // TODO: persist keySig.mode (major/minor) once leadSheetStore exposes setMode
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

  // Derived selection info for ContextPill
  const contextSelectionType: ContextPillSelectionType =
    selectedNotes.length > 0 ? 'note' : selectedBars.length > 0 ? 'bar' : 'none'

  // Get bounds of first selected bar/note for pill positioning
  const contextBounds =
    contextSelectionType === 'bar'
      ? getMeasureBounds(selectedBars[0])
      : contextSelectionType === 'note'
        ? getNoteBounds(selectedNotes[0].barIndex, selectedNotes[0].noteIndex)
        : null

  const handleContextDelete = useCallback(() => {
    // TODO: delete selected bars/notes via musicXmlEngine
  }, [])

  const handleContextClear = useCallback(() => {
    // TODO: clear selected bars via musicXmlEngine
  }, [])

  const handleContextCopy = useCallback(() => {
    // TODO: copy selected bars to clipboard
  }, [])

  const handleContextTranspose = useCallback(() => {
    // TODO: open transpose dialog for selected notes
  }, [])

  return (
    <div className={cn('relative flex-1 overflow-y-auto bg-surface-0', className)}>
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        className={cn('min-h-full p-6', toolMode === 'range' && 'cursor-crosshair')}
      />
      <ScoreOverlay>
        <PlaybackCursor getMeasureBounds={getMeasureBounds} />
        <SelectionRect box={selectionBox} />
        <ContextPill
          selectionType={contextSelectionType}
          bounds={contextBounds}
          onDelete={handleContextDelete}
          onClear={handleContextClear}
          onCopy={handleContextCopy}
          onTranspose={handleContextTranspose}
        />
      </ScoreOverlay>

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
 * Find which score element was clicked using DOM hit-testing.
 *
 * Checks for notes (vf-stavenote) first, then measures (vf-measure).
 * OSMD note ids follow the pattern "note-{barIndex}-{noteIndex}" (0-indexed).
 * OSMD measure ids are 1-indexed measure numbers.
 */
type ClickHit =
  | { type: 'bar'; barIndex: number }
  | { type: 'note'; barIndex: number; noteIndex: number }

function findClickedElement(clientX: number, clientY: number): ClickHit | null {
  const elements = document.elementsFromPoint(clientX, clientY)
  // Walk collected elements from top to bottom — prefer notes over bars
  let barHit: ClickHit | null = null
  for (const el of elements) {
    if (el.classList.contains('vf-stavenote')) {
      const match = /^note-(\d+)-(\d+)$/.exec(el.id)
      if (match) {
        return { type: 'note', barIndex: parseInt(match[1], 10), noteIndex: parseInt(match[2], 10) }
      }
    }
    if (!barHit && el.classList.contains('vf-measure')) {
      const n = parseInt(el.id, 10)
      if (!isNaN(n) && n > 0) {
        barHit = { type: 'bar', barIndex: n - 1 }
      }
    }
  }
  return barHit
}
