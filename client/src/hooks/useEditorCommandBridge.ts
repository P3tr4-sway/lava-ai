import { useEffect } from 'react'
import type { ScoreDocument, ScoreMeasureMeta, ScoreNoteEvent, ScorePitch } from '@lava/shared'
import { cloneScoreDocument } from '@/lib/scoreDocument'
import { durationToBeats } from '@/spaces/pack/editor-core/commands'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

type ClipboardPayload =
  | {
      kind: 'notes'
      sourceMeasureIndex: number
      sourceBeat: number
      notes: ScoreNoteEvent[]
    }
  | {
      kind: 'bars'
      sourceMeasureIndex: number
      measures: ScoreMeasureMeta[]
      notes: ScoreNoteEvent[]
    }

function noteTypeToDivisions(durationType: ScoreNoteEvent['durationType'], divisions: number) {
  switch (durationType) {
    case 'whole':
      return divisions * 4
    case 'half':
      return divisions * 2
    case 'quarter':
      return divisions
    case 'eighth':
      return Math.max(1, Math.round(divisions / 2))
    case 'sixteenth':
      return Math.max(1, Math.round(divisions / 4))
  }
}

function serializeClipboard(payload: ClipboardPayload) {
  return JSON.stringify(payload)
}

function parseClipboard(raw: string | null): ClipboardPayload | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as ClipboardPayload
    if (parsed.kind === 'notes' || parsed.kind === 'bars') {
      return parsed
    }
  } catch {}

  return null
}

function getTrackDocument() {
  const state = useScoreDocumentStore.getState()
  const track = state.document.tracks[0]
  return { document: state.document, track }
}

function buildNoteClipboardPayload(): ClipboardPayload | null {
  const { selectedNoteIds } = useEditorStore.getState()
  const { track } = getTrackDocument()
  if (!track || selectedNoteIds.length === 0) return null

  const notes = track.notes
    .filter((note) => selectedNoteIds.includes(note.id))
    .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
    .map((note) => structuredClone(note))

  if (notes.length === 0) return null

  return {
    kind: 'notes',
    sourceMeasureIndex: notes[0].measureIndex,
    sourceBeat: notes[0].beat,
    notes,
  }
}

function buildBarClipboardPayload(): ClipboardPayload | null {
  const { selectedBars } = useEditorStore.getState()
  const { document, track } = getTrackDocument()
  if (!track || selectedBars.length === 0) return null

  const sortedBars = selectedBars.slice().sort((a, b) => a - b)
  const [start, end] = [sortedBars[0], sortedBars[sortedBars.length - 1]]
  const measures = document.measures
    .filter((measure) => measure.index >= start && measure.index <= end)
    .map((measure) => structuredClone(measure))
  const notes = track.notes
    .filter((note) => note.measureIndex >= start && note.measureIndex <= end)
    .map((note) => structuredClone(note))

  if (measures.length === 0) return null

  return {
    kind: 'bars',
    sourceMeasureIndex: start,
    measures,
    notes,
  }
}

function toggleDotSelection(document: ScoreDocument): ScoreDocument {
  const next = cloneScoreDocument(document)
  const selectedNoteIds = new Set(useEditorStore.getState().selectedNoteIds)

  for (const track of next.tracks) {
    track.notes = track.notes.map((note) => {
      if (!selectedNoteIds.has(note.id)) return note
      const baseDivisions = noteTypeToDivisions(note.durationType, next.divisions)
      const dotted = note.dots > 0 ? 0 : 1
      return {
        ...note,
        dots: dotted,
        durationDivisions: dotted ? Math.round(baseDivisions * 1.5) : baseDivisions,
      }
    })
  }

  return next
}

function toggleTripletSelection(document: ScoreDocument): ScoreDocument {
  const next = cloneScoreDocument(document)
  const selectedNoteIds = new Set(useEditorStore.getState().selectedNoteIds)

  for (const track of next.tracks) {
    track.notes = track.notes.map((note) => {
      if (!selectedNoteIds.has(note.id)) return note
      const baseDivisions = noteTypeToDivisions(note.durationType, next.divisions)
      const tripletDivisions = Math.max(1, Math.round((baseDivisions * 2) / 3))
      const isTriplet = note.durationDivisions === tripletDivisions
      return {
        ...note,
        durationDivisions: isTriplet ? baseDivisions : tripletDivisions,
      }
    })
  }

  return next
}

function updatePitchAccidental(pitch: ScorePitch, accidental: 'sharp' | 'flat' | 'natural'): ScorePitch {
  if (accidental === 'natural') {
    const { alter: _ignored, ...rest } = pitch
    return rest
  }
  return {
    ...pitch,
    alter: accidental === 'sharp' ? 1 : -1,
  }
}

function pasteNotes(payload: Extract<ClipboardPayload, { kind: 'notes' }>) {
  const { document, track } = getTrackDocument()
  if (!track || payload.notes.length === 0) return

  const { caret, selectedBars } = useEditorStore.getState()
  const anchorMeasureIndex = caret?.measureIndex ?? selectedBars[0] ?? payload.sourceMeasureIndex
  const anchorBeat = caret?.beat ?? 0

  payload.notes.forEach((note) => {
    const measureOffset = note.measureIndex - payload.sourceMeasureIndex
    const beatOffset = note.beat - payload.sourceBeat
    const targetMeasureIndex = Math.max(0, Math.min(document.measures.length - 1, anchorMeasureIndex + measureOffset))
    const targetBeat = Math.max(0, anchorBeat + beatOffset)

    if (note.isRest) {
      useScoreDocumentStore.getState().applyCommand({
        type: 'insertRestAtCaret',
        trackId: track.id,
        measureIndex: targetMeasureIndex,
        beat: targetBeat,
        durationType: note.durationType,
      })
      return
    }

    useScoreDocumentStore.getState().applyCommand({
      type: 'insertNote',
      trackId: track.id,
      measureIndex: targetMeasureIndex,
      beat: targetBeat,
      note: {
        ...structuredClone(note),
        id: undefined,
        measureIndex: targetMeasureIndex,
        beat: targetBeat,
      },
    })
  })

  const lastNote = payload.notes[payload.notes.length - 1]
  const lastString = lastNote?.placement?.string ?? caret?.string ?? 1
  const lastBeat = anchorBeat + (lastNote.beat - payload.sourceBeat) + durationToBeats(lastNote.durationType)
  useEditorStore.getState().setCaret({
    trackId: track.id,
    measureIndex: anchorMeasureIndex + (lastNote.measureIndex - payload.sourceMeasureIndex),
    beat: lastBeat,
    string: lastString,
  })
}

function pasteBars(payload: Extract<ClipboardPayload, { kind: 'bars' }>) {
  const { document, track } = getTrackDocument()
  if (!track || payload.measures.length === 0) return

  const { selectedBars, caret } = useEditorStore.getState()
  const afterIndex = selectedBars.length > 0
    ? Math.max(...selectedBars)
    : caret?.measureIndex ?? Math.max(document.measures.length - 1, 0)

  useScoreDocumentStore.getState().applyCommand({
    type: 'addMeasureAfter',
    afterIndex,
    count: payload.measures.length,
  })

  payload.measures.forEach((measure, index) => {
    const targetMeasureIndex = afterIndex + index + 1

    measure.harmony.forEach((entry) => {
      useScoreDocumentStore.getState().applyCommand({
        type: 'setChordSymbol',
        measureIndex: targetMeasureIndex,
        beat: entry.beat,
        symbol: entry.symbol,
      })
    })

    if (measure.annotations[0]) {
      useScoreDocumentStore.getState().applyCommand({
        type: 'setAnnotation',
        measureIndex: targetMeasureIndex,
        text: measure.annotations[0],
      })
    }

    if (measure.sectionLabel) {
      useScoreDocumentStore.getState().applyCommand({
        type: 'setSectionLabel',
        startMeasureIndex: targetMeasureIndex,
        endMeasureIndex: targetMeasureIndex,
        label: measure.sectionLabel,
      })
    }

    if (measure.chordDiagramPlacement) {
      useScoreDocumentStore.getState().applyCommand({
        type: 'setChordDiagramPlacement',
        measureIndex: targetMeasureIndex,
        placement: measure.chordDiagramPlacement,
      })
    }
  })

  payload.notes.forEach((note) => {
    const targetMeasureIndex = afterIndex + (note.measureIndex - payload.sourceMeasureIndex) + 1
    useScoreDocumentStore.getState().applyCommand({
      type: 'insertNote',
      trackId: track.id,
      measureIndex: targetMeasureIndex,
      beat: note.beat,
      note: {
        ...structuredClone(note),
        id: undefined,
        measureIndex: targetMeasureIndex,
      },
    })
  })

  const firstInsertedBar = afterIndex + 1
  useEditorStore.getState().selectBar(firstInsertedBar)
}

function duplicateSelection() {
  const notePayload = buildNoteClipboardPayload()
  if (notePayload?.kind === 'notes') {
    useEditorStore.getState().setClipboard(serializeClipboard(notePayload))
    const { track } = getTrackDocument()
    if (!track) return
    const lastNote = notePayload.notes[notePayload.notes.length - 1]
    useEditorStore.getState().setCaret({
      trackId: track.id,
      measureIndex: lastNote.measureIndex,
      beat: lastNote.beat + durationToBeats(lastNote.durationType),
      string: lastNote.placement?.string ?? 1,
    })
    pasteNotes(notePayload)
    return
  }

  const barPayload = buildBarClipboardPayload()
  if (barPayload?.kind === 'bars') {
    useEditorStore.getState().setClipboard(serializeClipboard(barPayload))
    pasteBars(barPayload)
  }
}

export function useEditorCommandBridge(enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const handleCopy = () => {
      const payload = buildNoteClipboardPayload() ?? buildBarClipboardPayload()
      if (!payload) return
      useEditorStore.getState().setClipboard(serializeClipboard(payload))
    }

    const handlePaste = () => {
      const payload = parseClipboard(useEditorStore.getState().clipboard)
      if (!payload) return
      if (payload.kind === 'notes') {
        pasteNotes(payload)
        return
      }
      pasteBars(payload)
    }

    const handleDuplicate = () => {
      duplicateSelection()
    }

    const handleTranspose = (event: Event) => {
      const customEvent = event as CustomEvent<{ semitones?: number }>
      const semitones = customEvent.detail?.semitones
      const { track } = getTrackDocument()
      const { selectedNoteIds, selectedBars } = useEditorStore.getState()
      if (!track || !semitones) return

      useScoreDocumentStore.getState().applyCommand({
        type: 'transposeSelection',
        trackId: track.id,
        noteIds: selectedNoteIds.length > 0 ? selectedNoteIds : undefined,
        measureRange: selectedBars.length > 0 ? [Math.min(...selectedBars), Math.max(...selectedBars)] : null,
        semitones,
      })
    }

    const handleAccidental = (event: Event) => {
      const customEvent = event as CustomEvent<{ type?: 'sharp' | 'flat' | 'natural' }>
      const accidental = customEvent.detail?.type
      const { track } = getTrackDocument()
      const { selectedNoteIds } = useEditorStore.getState()
      if (!track || selectedNoteIds.length === 0 || !accidental) return

      selectedNoteIds.forEach((noteId) => {
        const note = track.notes.find((entry) => entry.id === noteId)
        if (!note?.pitch) return
        useScoreDocumentStore.getState().applyCommand({
          type: 'setPitch',
          trackId: track.id,
          noteId,
          pitch: updatePitchAccidental(note.pitch, accidental),
        })
      })
    }

    const handleToggleDot = () => {
      const { selectedNoteIds } = useEditorStore.getState()
      if (selectedNoteIds.length === 0) return
      useScoreDocumentStore.getState().setDocument(
        toggleDotSelection(useScoreDocumentStore.getState().document),
      )
    }

    const handleToggleTriplet = () => {
      const { selectedNoteIds } = useEditorStore.getState()
      if (selectedNoteIds.length === 0) return
      useScoreDocumentStore.getState().setDocument(
        toggleTripletSelection(useScoreDocumentStore.getState().document),
      )
    }

    const handleOpenFretboard = () => {
      useEditorStore.getState().requestInspectorFocus('fretboard')
    }

    const handleOpenDuration = () => {
      useEditorStore.getState().requestInspectorFocus('duration')
    }

    window.addEventListener('lava-copy', handleCopy)
    window.addEventListener('lava-paste', handlePaste)
    window.addEventListener('lava-duplicate', handleDuplicate)
    window.addEventListener('lava-transpose', handleTranspose as EventListener)
    window.addEventListener('lava-accidental', handleAccidental as EventListener)
    window.addEventListener('lava-toggle-dot', handleToggleDot)
    window.addEventListener('lava-toggle-triplet', handleToggleTriplet)
    window.addEventListener('lava-open-fretboard', handleOpenFretboard)
    window.addEventListener('lava-open-duration', handleOpenDuration)

    return () => {
      window.removeEventListener('lava-copy', handleCopy)
      window.removeEventListener('lava-paste', handlePaste)
      window.removeEventListener('lava-duplicate', handleDuplicate)
      window.removeEventListener('lava-transpose', handleTranspose as EventListener)
      window.removeEventListener('lava-accidental', handleAccidental as EventListener)
      window.removeEventListener('lava-toggle-dot', handleToggleDot)
      window.removeEventListener('lava-toggle-triplet', handleToggleTriplet)
      window.removeEventListener('lava-open-fretboard', handleOpenFretboard)
      window.removeEventListener('lava-open-duration', handleOpenDuration)
    }
  }, [enabled])
}
