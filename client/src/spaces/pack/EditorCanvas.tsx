import { useEffect, useRef, useCallback, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAudioStore } from '@/stores/audioStore'
import { useVersionStore } from '@/stores/versionStore'
import { useScoreSync } from '@/hooks/useScoreSync'
import { ScoreOverlay } from '@/components/score/ScoreOverlay'
import { PlaybackCursor } from '@/components/score/PlaybackCursor'
import { SelectionRect } from '@/components/score/SelectionRect'
import { ContextPill, type ContextPillSelectionType } from '@/components/score/ContextPill'
import { MiniFretboard, DurationPalette, LyricInput, AnnotationInput, ChordDiagramPopover } from '@/components/score'
import { useRangeSelect } from '@/hooks/useRangeSelect'
import { ChordPopover } from './ChordPopover'
import { KeySigPopover } from './KeySigPopover'
import { TextAnnotationInput } from './TextAnnotationInput'
import {
  clearBars, copyBars, pasteBars, duplicateBars, transposeBars,
  setNotePitch, setNoteDuration, addAccidental, toggleTie, toggleRest,
  setLyric, setAnnotation, setChord, setKeySig, setTimeSig,
  parseXml, getMeasures,
} from '@/lib/musicXmlEngine'
import { midiToPitch, pitchToMidi } from '@/lib/pitchUtils'
import type { Pitch } from '@/lib/pitchUtils'

/** Returns true when editing actions should be blocked (transform mode or version preview). */
function isEditingDisabled(): boolean {
  return (
    useEditorStore.getState().editorMode === 'transform' ||
    useVersionStore.getState().previewVersionId !== null
  )
}

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

  const editorMode = useEditorStore((s) => s.editorMode)
  const isPreview = useVersionStore((s) => s.previewVersionId !== null)
  // Render-time reactive version of isEditingDisabled() (module-level fn uses getState() for callbacks)
  const editingDisabled = editorMode === 'transform' || isPreview

  const { syncHighlights, getMeasureBounds, getNoteBounds } = useScoreSync(containerRef)
  const { selectionBox, onMouseDown, onMouseMove, onMouseUp } = useRangeSelect(
    containerRef,
    getMeasureBounds,
  )

  const [popover, setPopover] = useState<PopoverState | null>(null)

  const musicXml = useLeadSheetStore((s) => s.musicXml)

  // Overlay state
  const [fretboardState, setFretboardState] = useState<{ visible: boolean; x: number; y: number; midi?: number }>({ visible: false, x: 0, y: 0 })
  const [durationState, setDurationState] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 })
  const [lyricState, setLyricState] = useState<{ visible: boolean; x: number; y: number; barIndex: number; noteIndex: number }>({ visible: false, x: 0, y: 0, barIndex: 0, noteIndex: 0 })
  const [annotationState, setAnnotationState] = useState<{ visible: boolean; x: number; y: number; barIndex: number }>({ visible: false, x: 0, y: 0, barIndex: 0 })
  const [chordDiagramHover] = useState<{ visible: boolean; x: number; y: number; chordName: string }>({ visible: false, x: 0, y: 0, chordName: '' })

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

      if (hit.type === 'note' && toolMode === 'pointer' && !editingDisabled) {
        selectNote(hit.barIndex, hit.noteIndex, e.shiftKey)
        syncHighlights()
        return
      }

      const barIndex = hit.barIndex

      // Click-to-reposition playhead when stopped or paused
      const { transportState, setCurrentBar } = useAudioStore.getState()
      if (transportState === 'stopped' || transportState === 'paused') {
        setCurrentBar(barIndex)
      }

      if (toolMode === 'pointer') {
        selectBar(barIndex, e.shiftKey)
        syncHighlights()
      } else if (!editingDisabled && (toolMode === 'chord' || toolMode === 'keySig' || toolMode === 'text')) {
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
    [toolMode, selectBar, selectNote, clearSelection, syncHighlights, editingDisabled],
  )

  const handleChordSelect = useCallback(
    (chord: { root: string; quality: string }) => {
      const xml = getXml()
      if (!xml || !popover) return
      const { pushUndo } = useEditorStore.getState()
      const chordSymbol = chord.quality ? `${chord.root}${chord.quality}` : chord.root
      try {
        const newXml = setChord(xml, popover.barIndex, 0 /* beat index 0 — chord applies to the first beat of the bar */, chordSymbol)
        pushUndo(xml)
        saveXml(newXml)
        syncHighlights()
        setPopover(null)
      } catch (err) {
        console.error('[handleChordSelect]', err)
      }
    },
    [popover, syncHighlights],
  )

  const handleKeySigSelect = useCallback(
    (keySig: { key: string; mode: 'major' | 'minor'; timeSig: string }) => {
      const xml = getXml()
      if (!xml || !popover) return
      const { pushUndo } = useEditorStore.getState()
      try {
        let newXml = setKeySig(xml, popover.barIndex, keySig.key)
        const [beats, beatType] = keySig.timeSig.split('/').map(Number)
        if (beats && beatType) {
          newXml = setTimeSig(newXml, popover.barIndex, beats, beatType)
        }
        pushUndo(xml)
        saveXml(newXml)
        syncHighlights()
        useLeadSheetStore.getState().setKey(keySig.key)
        useLeadSheetStore.getState().setTimeSignature(keySig.timeSig)
      } catch (err) {
        console.error('[handleKeySigSelect]', err)
      }
      setPopover(null)
    },
    [popover, syncHighlights],
  )

  const handleTextSubmit = useCallback(
    (text: string) => {
      const xml = getXml()
      if (!xml || !popover) return
      const { pushUndo } = useEditorStore.getState()
      try {
        const newXml = setAnnotation(xml, popover.barIndex, text)
        pushUndo(xml)
        saveXml(newXml)
        syncHighlights()
        setPopover(null)
      } catch (err) {
        console.error('[handleTextSubmit]', err)
      }
    },
    [popover, syncHighlights],
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

  // Helper functions — no deps, defined inline
  function getXml() {
    return useLeadSheetStore.getState().musicXml
  }
  function saveXml(newXml: string) {
    useLeadSheetStore.getState().setMusicXml(newXml)
    useEditorStore.getState().setSaveStatus('unsaved')
  }

  const handleContextDelete = useCallback(() => {
    const xml = getXml()
    const { selectedNotes: notes, selectedBars: bars, pushUndo } = useEditorStore.getState()
    if (!xml) return
    if (notes.length > 0) {
      // Toggle each selected note to rest
      try {
        let newXml = xml
        for (const { barIndex, noteIndex } of notes) {
          newXml = toggleRest(newXml, barIndex, noteIndex)
        }
        pushUndo(xml)
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[handleContextDelete]', err) }
    } else if (bars.length > 0) {
      window.dispatchEvent(new CustomEvent('lava-bar-delete'))
    }
  }, [syncHighlights])

  const handleContextClear = useCallback(() => {
    const xml = getXml()
    const { selectedBars: bars, pushUndo } = useEditorStore.getState()
    if (!xml || bars.length === 0) return
    try {
      const newXml = clearBars(xml, bars)
      pushUndo(xml)
      saveXml(newXml)
      syncHighlights()
    } catch (err) { console.error('[handleContextClear]', err) }
  }, [syncHighlights])

  const handleContextCopy = useCallback(() => {
    const xml = getXml()
    const { selectedBars: bars } = useEditorStore.getState()
    if (!xml || bars.length === 0) return
    try {
      const fragment = copyBars(xml, bars)
      useEditorStore.getState().setClipboard(fragment)
    } catch (err) { console.error('[handleContextCopy]', err) }
  }, [])

  const handleContextTranspose = useCallback(() => {
    const xml = getXml()
    const { selectedBars: bars, pushUndo } = useEditorStore.getState()
    if (!xml || bars.length === 0) return
    try {
      const newXml = transposeBars(xml, bars, 1)
      pushUndo(xml)
      saveXml(newXml)
      syncHighlights()
    } catch (err) { console.error('[handleContextTranspose]', err) }
  }, [syncHighlights])

  // Custom keyboard event handlers dispatched from useEditorKeyboard
  useEffect(() => {
    function onLavaPitchStep(e: CustomEvent<{ steps: number }>) {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedNotes, pushUndo } = useEditorStore.getState()
      if (!xml || selectedNotes.length === 0) return
      try {
        const doc = parseXml(xml)
        const measures = getMeasures(doc)
        let newXml = xml
        pushUndo(xml)
        for (const { barIndex, noteIndex } of selectedNotes) {
          const measure = measures[barIndex]
          if (!measure) continue
          const noteEls = Array.from(measure.querySelectorAll('note')).filter(
            (n) => !n.querySelector('chord'),
          )
          const noteEl = noteEls[noteIndex]
          if (!noteEl) continue
          const pitchEl = noteEl.querySelector('pitch')
          if (!pitchEl) continue // skip rests
          const step = pitchEl.querySelector('step')?.textContent ?? 'C'
          const octave = parseInt(pitchEl.querySelector('octave')?.textContent ?? '4', 10)
          const alter = parseFloat(pitchEl.querySelector('alter')?.textContent ?? '0')
          const currentPitch: Pitch = { step, octave, alter: alter || undefined }
          const currentMidi = pitchToMidi(currentPitch)
          const newMidi = Math.max(21, Math.min(108, currentMidi + e.detail.steps))
          const newPitch = midiToPitch(newMidi, alter < 0)
          newXml = setNotePitch(newXml, barIndex, noteIndex, newPitch)
        }
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-pitch-step]', err) }
    }

    function onLavaDurationKey(e: CustomEvent<{ key: string }>) {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedNotes: notes, pushUndo } = useEditorStore.getState()
      if (!xml || notes.length === 0) return
      const map: Record<string, ['whole' | 'half' | 'quarter' | 'eighth' | '16th', number]> = {
        '1': ['whole', 4], '2': ['half', 2], '3': ['quarter', 1], '4': ['eighth', 0.5], '5': ['16th', 0.25],
      }
      const dur = map[e.detail.key]
      if (!dur) return
      try {
        let newXml = xml
        pushUndo(xml)
        for (const { barIndex, noteIndex } of notes) {
          newXml = setNoteDuration(newXml, barIndex, noteIndex, dur[0], dur[1])
        }
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-duration-key]', err) }
    }

    function onLavaAccidental(e: CustomEvent<{ type: 'sharp' | 'flat' | 'natural' }>) {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedNotes: notes, pushUndo } = useEditorStore.getState()
      if (!xml || notes.length === 0) return
      try {
        let newXml = xml
        pushUndo(xml)
        for (const { barIndex, noteIndex } of notes) {
          newXml = addAccidental(newXml, barIndex, noteIndex, e.detail.type)
        }
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-accidental]', err) }
    }

    function onLavaToggleTie() {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedNotes: notes, pushUndo } = useEditorStore.getState()
      if (!xml || notes.length === 0) return
      try {
        let newXml = xml
        pushUndo(xml)
        for (const { barIndex, noteIndex } of notes) {
          newXml = toggleTie(newXml, barIndex, noteIndex)
        }
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-toggle-tie]', err) }
    }

    function onLavaToggleRest() {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedNotes: notes, pushUndo } = useEditorStore.getState()
      if (!xml || notes.length === 0) return
      try {
        let newXml = xml
        pushUndo(xml)
        for (const { barIndex, noteIndex } of notes) {
          newXml = toggleRest(newXml, barIndex, noteIndex)
        }
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-toggle-rest]', err) }
    }

    function onLavaOpenFretboard() {
      if (isEditingDisabled()) return
      const { selectedNotes: notes } = useEditorStore.getState()
      if (notes.length === 0) return
      const { barIndex, noteIndex } = notes[0]
      const bounds = getNoteBounds(barIndex, noteIndex)
      if (bounds) {
        setFretboardState({ visible: true, x: bounds.x, y: bounds.y - 10 })
      }
    }

    function onLavaOpenDuration() {
      if (isEditingDisabled()) return
      const { selectedNotes: notes } = useEditorStore.getState()
      if (notes.length === 0) return
      const { barIndex, noteIndex } = notes[0]
      const bounds = getNoteBounds(barIndex, noteIndex)
      if (bounds) {
        setDurationState({ visible: true, x: bounds.x, y: bounds.y - 10 })
      }
    }

    function onLavaCopy() {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedBars: bars } = useEditorStore.getState()
      if (!xml || bars.length === 0) return
      try {
        const fragment = copyBars(xml, bars)
        useEditorStore.getState().setClipboard(fragment)
      } catch (err) { console.error('[lava-copy]', err) }
    }

    function onLavaPaste() {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedBars: bars, clipboard, pushUndo } = useEditorStore.getState()
      if (!xml || !clipboard) return
      const afterIndex = bars.length > 0 ? Math.max(...bars) : -1
      try {
        const newXml = pasteBars(xml, clipboard, Math.max(afterIndex, 0))
        pushUndo(xml)
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-paste]', err) }
    }

    function onLavaDuplicate() {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedBars: bars, pushUndo } = useEditorStore.getState()
      if (!xml || bars.length === 0) return
      try {
        const insertAfter = Math.max(...bars)
        const newXml = duplicateBars(xml, bars, insertAfter)
        pushUndo(xml)
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-duplicate]', err) }
    }

    function onLavaTranspose(e: CustomEvent<{ semitones: number }>) {
      if (isEditingDisabled()) return
      const xml = getXml()
      const { selectedBars: bars, pushUndo } = useEditorStore.getState()
      if (!xml || bars.length === 0) return
      try {
        const newXml = transposeBars(xml, bars, e.detail.semitones)
        pushUndo(xml)
        saveXml(newXml)
        syncHighlights()
      } catch (err) { console.error('[lava-transpose]', err) }
    }

    window.addEventListener('lava-pitch-step', onLavaPitchStep as EventListener)
    window.addEventListener('lava-duration-key', onLavaDurationKey as EventListener)
    window.addEventListener('lava-accidental', onLavaAccidental as EventListener)
    window.addEventListener('lava-toggle-tie', onLavaToggleTie)
    window.addEventListener('lava-toggle-rest', onLavaToggleRest)
    window.addEventListener('lava-open-fretboard', onLavaOpenFretboard)
    window.addEventListener('lava-open-duration', onLavaOpenDuration)
    window.addEventListener('lava-copy', onLavaCopy)
    window.addEventListener('lava-paste', onLavaPaste)
    window.addEventListener('lava-duplicate', onLavaDuplicate)
    window.addEventListener('lava-transpose', onLavaTranspose as EventListener)

    return () => {
      window.removeEventListener('lava-pitch-step', onLavaPitchStep as EventListener)
      window.removeEventListener('lava-duration-key', onLavaDurationKey as EventListener)
      window.removeEventListener('lava-accidental', onLavaAccidental as EventListener)
      window.removeEventListener('lava-toggle-tie', onLavaToggleTie)
      window.removeEventListener('lava-toggle-rest', onLavaToggleRest)
      window.removeEventListener('lava-open-fretboard', onLavaOpenFretboard)
      window.removeEventListener('lava-open-duration', onLavaOpenDuration)
      window.removeEventListener('lava-copy', onLavaCopy)
      window.removeEventListener('lava-paste', onLavaPaste)
      window.removeEventListener('lava-duplicate', onLavaDuplicate)
      window.removeEventListener('lava-transpose', onLavaTranspose as EventListener)
    }
  }, [syncHighlights, getNoteBounds])

  // Overlay component handlers
  const handleFretSelect = useCallback((midi: number) => {
    const xml = getXml()
    const { selectedNotes: notes, pushUndo } = useEditorStore.getState()
    if (!xml || notes.length === 0) return
    const { barIndex, noteIndex } = notes[0]
    try {
      const pitch = midiToPitch(midi)
      const newXml = setNotePitch(xml, barIndex, noteIndex, pitch)
      pushUndo(xml)
      saveXml(newXml)
      syncHighlights()
    } catch (err) { console.error('[handleFretSelect]', err) }
    setFretboardState((s) => ({ ...s, visible: false }))
  }, [syncHighlights])

  const handleDurationSelect = useCallback((type: 'whole' | 'half' | 'quarter' | 'eighth' | '16th', divisions: number) => {
    const xml = getXml()
    const { selectedNotes: notes, pushUndo } = useEditorStore.getState()
    if (!xml || notes.length === 0) return
    try {
      let newXml = xml
      pushUndo(xml)
      for (const { barIndex, noteIndex } of notes) {
        newXml = setNoteDuration(newXml, barIndex, noteIndex, type, divisions)
      }
      saveXml(newXml)
      syncHighlights()
    } catch (err) { console.error('[handleDurationSelect]', err) }
    setDurationState((s) => ({ ...s, visible: false }))
  }, [syncHighlights])

  const handleLyricSubmit = useCallback((text: string) => {
    const xml = getXml()
    const { barIndex, noteIndex } = lyricState
    if (!xml) return
    try {
      const newXml = setLyric(xml, barIndex, noteIndex, text)
      useEditorStore.getState().pushUndo(xml)
      saveXml(newXml)
    } catch (err) { console.error('[handleLyricSubmit]', err) }
    setLyricState((s) => ({ ...s, visible: false }))
  }, [lyricState])

  const handleAnnotationSubmit = useCallback((text: string) => {
    const xml = getXml()
    const { barIndex } = annotationState
    if (!xml) return
    try {
      const newXml = setAnnotation(xml, barIndex, text)
      useEditorStore.getState().pushUndo(xml)
      saveXml(newXml)
    } catch (err) { console.error('[handleAnnotationSubmit]', err) }
    setAnnotationState((s) => ({ ...s, visible: false }))
  }, [annotationState])

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
          readOnly={editingDisabled}
        />
        <MiniFretboard
          visible={fretboardState.visible}
          x={fretboardState.x}
          y={fretboardState.y}
          currentMidi={fretboardState.midi}
          onFretSelect={handleFretSelect}
        />
        <DurationPalette
          visible={durationState.visible}
          x={durationState.x}
          y={durationState.y}
          onDurationSelect={handleDurationSelect}
          onToggleDot={() => window.dispatchEvent(new CustomEvent('lava-toggle-dot'))}
          onToggleTriplet={() => window.dispatchEvent(new CustomEvent('lava-toggle-triplet'))}
        />
        <LyricInput
          visible={lyricState.visible}
          x={lyricState.x}
          y={lyricState.y}
          onSubmit={handleLyricSubmit}
          onAdvance={() => setLyricState((s) => ({ ...s, visible: false }))}
          onDismiss={() => setLyricState((s) => ({ ...s, visible: false }))}
        />
        <AnnotationInput
          visible={annotationState.visible}
          x={annotationState.x}
          y={annotationState.y}
          onSubmit={handleAnnotationSubmit}
          onDismiss={() => setAnnotationState((s) => ({ ...s, visible: false }))}
        />
        <ChordDiagramPopover
          visible={chordDiagramHover.visible}
          x={chordDiagramHover.x}
          y={chordDiagramHover.y}
          chordName={chordDiagramHover.chordName}
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
