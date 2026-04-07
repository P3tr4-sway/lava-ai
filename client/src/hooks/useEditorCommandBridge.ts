import { useEffect } from 'react'
import type { BarlineType, Clef, RepeatMarker } from '@lava/shared'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

const TEMPO_LABEL_BPM: Record<string, number> = {
  Largo: 50,
  Andante: 92,
  Moderato: 114,
  Allegro: 144,
  Presto: 184,
}

const BARLINE_TYPE_MAP: Record<string, BarlineType> = {
  Single: 'single',
  Double: 'double',
  Final: 'final',
  Dashed: 'dashed',
  Dotted: 'dotted',
}

const REPEAT_MARKER_MAP: Record<string, RepeatMarker> = {
  'D.C. al Fine': 'dc-al-fine',
  'D.S. al Coda': 'ds-al-coda',
  Segno: 'segno',
  Fine: 'fine',
  Coda: 'coda',
}

function parseKeySig(value: string): { key: string; mode: 'major' | 'minor' } {
  const parts = value.split(' ')
  return {
    key: parts[0] ?? 'C',
    mode: parts[1] === 'minor' ? 'minor' : 'major',
  }
}

function parseTimeSig(value: string): { numerator: number; denominator: number } {
  const [num, den] = value.split('/').map(Number)
  return { numerator: num ?? 4, denominator: den ?? 4 }
}

function getSelectedMeasureIndex(): number | null {
  const { caret, selectedBars } = useEditorStore.getState()
  if (selectedBars.length > 0) return Math.min(...selectedBars)
  if (caret) return caret.measureIndex
  return null
}

function getTrackDocument() {
  const state = useScoreDocumentStore.getState()
  const track = state.document.tracks[0]
  return { document: state.document, track }
}

export function useEditorCommandBridge(enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const handleKeySig = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value
      if (!value) return
      const { key, mode } = parseKeySig(value)
      useScoreDocumentStore.getState().applyCommand({ type: 'setKeySignature', key, mode })
    }

    const handleTimeSig = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value
      if (!value) return
      const { numerator, denominator } = parseTimeSig(value)
      useScoreDocumentStore.getState().applyCommand({ type: 'setTimeSignature', numerator, denominator })
    }

    const handleTempo = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value
      if (!value) return
      const bpm = TEMPO_LABEL_BPM[value]
      if (!bpm) return
      useScoreDocumentStore.getState().applyCommand({ type: 'setTempo', bpm })
      useAudioStore.getState().setBpm(bpm)
    }

    const handleClef = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value
      if (!value) return
      const { track } = getTrackDocument()
      if (!track) return
      useScoreDocumentStore.getState().applyCommand({
        type: 'setTrackClef',
        trackId: track.id,
        clef: value.toLowerCase() as Clef,
      })
    }

    const handleBarline = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value
      if (!value) return
      const barlineType = BARLINE_TYPE_MAP[value]
      if (!barlineType) return
      const measureIndex = getSelectedMeasureIndex()
      if (measureIndex === null) return
      // Apply to all selected bars
      const { selectedBars } = useEditorStore.getState()
      const indices = selectedBars.length > 0 ? selectedBars : [measureIndex]
      indices.forEach((idx) => {
        useScoreDocumentStore.getState().applyCommand({ type: 'setBarlineType', measureIndex: idx, barlineType })
      })
    }

    const handleRepeat = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value
      if (!value) return
      const measureIndex = getSelectedMeasureIndex()
      if (measureIndex === null) return

      if (value === 'Repeat start') {
        useScoreDocumentStore.getState().applyCommand({ type: 'setRepeat', measureIndex, repeatType: 'start', enabled: true })
        return
      }
      if (value === 'Repeat end') {
        useScoreDocumentStore.getState().applyCommand({ type: 'setRepeat', measureIndex, repeatType: 'end', enabled: true })
        return
      }
      const marker = REPEAT_MARKER_MAP[value]
      if (marker) {
        useScoreDocumentStore.getState().applyCommand({ type: 'setRepeatMarker', measureIndex, marker })
      }
    }

    const handlePitchMode = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value
      if (!value) return
      const { track } = getTrackDocument()
      if (!track) return
      const { selectedNoteIds, selectedBars } = useEditorStore.getState()
      if (value === 'Octave up' || value === 'Octave down') {
        const semitones = value === 'Octave up' ? 12 : -12
        useScoreDocumentStore.getState().applyCommand({
          type: 'transposeSelection',
          trackId: track.id,
          noteIds: selectedNoteIds.length > 0 ? selectedNoteIds : undefined,
          measureRange: selectedBars.length > 0 ? [Math.min(...selectedBars), Math.max(...selectedBars)] : null,
          semitones,
        })
      }
      // 'Concert pitch' and 'Chromatic' are display/input modes, no document mutation needed
    }

    window.addEventListener('lava-key-sig', handleKeySig as EventListener)
    window.addEventListener('lava-time-sig', handleTimeSig as EventListener)
    window.addEventListener('lava-tempo', handleTempo as EventListener)
    window.addEventListener('lava-clef', handleClef as EventListener)
    window.addEventListener('lava-barline', handleBarline as EventListener)
    window.addEventListener('lava-repeat', handleRepeat as EventListener)
    window.addEventListener('lava-pitch-mode', handlePitchMode as EventListener)

    return () => {
      window.removeEventListener('lava-key-sig', handleKeySig as EventListener)
      window.removeEventListener('lava-time-sig', handleTimeSig as EventListener)
      window.removeEventListener('lava-tempo', handleTempo as EventListener)
      window.removeEventListener('lava-clef', handleClef as EventListener)
      window.removeEventListener('lava-barline', handleBarline as EventListener)
      window.removeEventListener('lava-repeat', handleRepeat as EventListener)
      window.removeEventListener('lava-pitch-mode', handlePitchMode as EventListener)
    }
  }, [enabled])
}
