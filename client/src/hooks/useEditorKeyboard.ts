import { useEffect } from 'react'
import type { NoteValue } from '@lava/shared'
import { moveCaretByStep } from '@/spaces/pack/editor-core/commands'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

const DURATIONS = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] as const
const DURATION_SHORTCUTS: Record<string, NoteValue> = {
  '1': 'whole',
  '2': 'half',
  '4': 'quarter',
  '8': 'eighth',
  '6': 'sixteenth',
}

function durationTypeToStep(duration: NoteValue): number {
  switch (duration) {
    case 'whole':
      return 4
    case 'half':
      return 2
    case 'quarter':
      return 1
    case 'eighth':
      return 0.5
    case 'sixteenth':
      return 0.25
  }
}

function getOrderedNoteIds() {
  return (useScoreDocumentStore.getState().document.tracks[0]?.notes ?? [])
    .slice()
    .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
    .map((note) => note.id)
}

export function useEditorKeyboard(enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const meta = e.metaKey || e.ctrlKey

      if (e.key === ' ') {
        e.preventDefault()
        const { playbackState, setPlaybackState } = useAudioStore.getState()
        if (playbackState === 'playing') {
          setPlaybackState('paused')
        } else {
          setPlaybackState('playing')
        }
        return
      }

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().undo()
        return
      }

      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().redo()
        return
      }

      if (meta && e.key === '/') {
        e.preventDefault()
        useEditorStore.getState().toggleChatPanel()
        return
      }

      if (e.key === 'Escape') {
        useEditorStore.getState().clearSelection()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedBars, selectedNoteIds, clearSelection, clearNoteSelection } = useEditorStore.getState()
        if (selectedNoteIds.length > 0) {
          e.preventDefault()
          selectedNoteIds.forEach((noteId) => {
            useScoreDocumentStore.getState().applyCommand({
              type: 'deleteNote',
              trackId: useScoreDocumentStore.getState().document.tracks[0]?.id ?? '',
              noteId,
            })
          })
          clearNoteSelection()
          return
        }
        if (selectedBars.length > 0) {
          e.preventDefault()
          useScoreDocumentStore.getState().applyCommand({
            type: 'deleteMeasureRange',
            start: Math.min(...selectedBars),
            end: Math.max(...selectedBars),
          })
          clearSelection()
        }
        return
      }

      // Cmd+C — copy
      if (meta && e.key === 'c') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('lava-copy'))
        return
      }
      // Cmd+V — paste
      if (meta && e.key === 'v') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('lava-paste'))
        return
      }
      // Cmd+D — duplicate
      if (meta && e.key === 'd') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('lava-duplicate'))
        return
      }
      // Cmd+Shift+Up/Down — transpose
      if (meta && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const semitones = e.key === 'ArrowUp' ? 1 : -1
        window.dispatchEvent(new CustomEvent('lava-transpose', { detail: { semitones } }))
        return
      }

      // Tool shortcuts (single letter, no modifier)
      if (!meta && !e.altKey) {
        const {
          selectedNoteIds,
          cursorNoteId,
          setCursorNoteId,
          caret,
          setCaret,
          entryDuration,
          entryMode,
          setEntryDuration,
        } = useEditorStore.getState()
        const track = useScoreDocumentStore.getState().document.tracks[0]
        const document = useScoreDocumentStore.getState().document

        if (e.key === 'Enter') {
          e.preventDefault()
          const afterIndex = useEditorStore.getState().selectedBars.length > 0
            ? Math.max(...useEditorStore.getState().selectedBars)
            : caret
              ? caret.measureIndex
              : document.measures.length - 1
          useScoreDocumentStore.getState().applyCommand({
            type: 'addMeasureAfter',
            afterIndex: Math.max(afterIndex, 0),
            count: 1,
          })
          useEditorStore.getState().selectBar(Math.max(afterIndex + 1, 0))
          return
        }

        if (!caret && selectedNoteIds.length === 0 && DURATION_SHORTCUTS[e.key]) {
          e.preventDefault()
          setEntryDuration(DURATION_SHORTCUTS[e.key])
          return
        }

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
          if (caret) {
            e.preventDefault()
            setCaret(
              moveCaretByStep(
                caret,
                e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? 'left' : 'right',
                document.measures.length,
                document.meter.numerator,
              ),
            )
            return
          }
          const ordered = getOrderedNoteIds()
          if (ordered.length > 0) {
            e.preventDefault()
            const currentId = cursorNoteId ?? selectedNoteIds[0] ?? ordered[0]
            const currentIndex = Math.max(0, ordered.indexOf(currentId))
            const delta = e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1
            const nextIndex = Math.max(0, Math.min(ordered.length - 1, currentIndex + delta))
            const nextId = ordered[nextIndex]
            useEditorStore.getState().selectNoteById(nextId)
            setCursorNoteId(nextId)
          }
          return
        }

        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedNoteIds.length > 0 && track) {
          e.preventDefault()
          const direction = e.key === 'ArrowUp' ? -1 : 1
          selectedNoteIds.forEach((noteId) => {
            const note = track.notes.find((entry) => entry.id === noteId)
            if (!note?.placement) return
            const nextString = Math.max(1, Math.min(6, note.placement.string + direction))
            useScoreDocumentStore.getState().applyCommand({
              type: 'setStringFret',
              trackId: track.id,
              noteId,
              string: nextString,
              fret: note.placement.fret,
            })
          })
          return
        }

        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && caret) {
          e.preventDefault()
          setCaret(
            moveCaretByStep(
              caret,
              e.key === 'ArrowUp' ? 'up' : 'down',
              document.measures.length,
              document.meter.numerator,
            ),
          )
          return
        }

        if ((e.key === '[' || e.key === ']') && selectedNoteIds.length > 0 && track) {
          e.preventDefault()
          selectedNoteIds.forEach((noteId) => {
            const note = track.notes.find((entry) => entry.id === noteId)
            if (!note) return
            const currentIndex = DURATIONS.indexOf(note.durationType)
            const nextIndex = e.key === '['
              ? Math.max(0, currentIndex - 1)
              : Math.min(DURATIONS.length - 1, currentIndex + 1)
            const durationType = DURATIONS[nextIndex]
            const durationDivisions = durationType === 'whole'
              ? track.notes.length >= 0
                ? useScoreDocumentStore.getState().document.divisions * 4
                : 4
              : durationType === 'half'
                ? useScoreDocumentStore.getState().document.divisions * 2
                : durationType === 'quarter'
                  ? useScoreDocumentStore.getState().document.divisions
                  : durationType === 'eighth'
                    ? Math.max(1, useScoreDocumentStore.getState().document.divisions / 2)
                    : Math.max(1, useScoreDocumentStore.getState().document.divisions / 4)
            useScoreDocumentStore.getState().applyCommand({
              type: 'setDuration',
              trackId: track.id,
              noteId,
              durationType,
              durationDivisions,
            })
          })
          return
        }

        if (/^[0-9]$/.test(e.key) && selectedNoteIds.length > 0 && track) {
          e.preventDefault()
          selectedNoteIds.forEach((noteId) => {
            const note = track.notes.find((entry) => entry.id === noteId)
            if (!note?.placement) return
            useScoreDocumentStore.getState().applyCommand({
              type: 'setStringFret',
              trackId: track.id,
              noteId,
              string: note.placement.string,
              fret: Number(e.key),
            })
          })
          return
        }

        if (/^[0-9]$/.test(e.key) && caret && track) {
          e.preventDefault()
          useScoreDocumentStore.getState().applyCommand(
            entryMode === 'rest'
              ? {
                  type: 'insertRestAtCaret',
                  trackId: track.id,
                  measureIndex: caret.measureIndex,
                  beat: caret.beat,
                  durationType: entryDuration,
                }
              : {
                  type: 'insertNoteAtCaret',
                  trackId: track.id,
                  measureIndex: caret.measureIndex,
                  beat: caret.beat,
                  string: caret.string,
                  fret: Number(e.key),
                  durationType: entryDuration,
                },
          )
          setCaret({
            ...moveCaretByStep(
              caret,
              'right',
              document.measures.length,
              document.meter.numerator,
              durationTypeToStep(entryDuration),
            ),
            trackId: track.id,
          })
          return
        }

        switch (e.key.toLowerCase()) {
          case 'v':
            useEditorStore.getState().setToolMode('pointer')
            useEditorStore.getState().setActiveToolGroup('selection')
            break
          case 'c':
            useEditorStore.getState().setToolMode('chord')
            break
          case 't':
            useEditorStore.getState().setToolMode('text')
            break
          case 'r': {
            // Toggle rest when notes are selected; insert rest at caret if active; else reset tool mode
            const { selectedNoteIds, setToolMode } = useEditorStore.getState()
            if (selectedNoteIds.length > 0) {
              const trackId = useScoreDocumentStore.getState().document.tracks[0]?.id ?? ''
              selectedNoteIds.forEach((noteId) => {
                useScoreDocumentStore.getState().applyCommand({ type: 'toggleRest', trackId, noteId })
              })
            } else if (caret && track) {
              useScoreDocumentStore.getState().applyCommand({
                type: 'insertRestAtCaret',
                trackId: track.id,
                measureIndex: caret.measureIndex,
                beat: caret.beat,
                durationType: entryDuration,
              })
              useEditorStore.getState().setEntryMode('rest')
            } else {
              setToolMode('pointer')
            }
            break
          }
          case 'k':
            useEditorStore.getState().setToolMode(
              useEditorStore.getState().toolMode === 'keySig' ? 'pointer' : 'keySig'
            )
            break
          case 'f': {
            const { selectedNoteIds } = useEditorStore.getState()
            if (selectedNoteIds.length > 0) window.dispatchEvent(new CustomEvent('lava-open-fretboard'))
            break
          }
          case 'd': {
            const { selectedNoteIds } = useEditorStore.getState()
            if (selectedNoteIds.length > 0) window.dispatchEvent(new CustomEvent('lava-open-duration'))
            break
          }
          case '#':
            window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'sharp' } }))
            break
          case 'b': {
            const { selectedNoteIds } = useEditorStore.getState()
            if (selectedNoteIds.length > 0)
              window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'flat' } }))
            break
          }
          case 'n': {
            const { selectedNoteIds } = useEditorStore.getState()
            if (selectedNoteIds.length > 0)
              window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'natural' } }))
            break
          }
          case 'l':
            if (selectedNoteIds.length > 0) {
              const trackId = useScoreDocumentStore.getState().document.tracks[0]?.id ?? ''
              selectedNoteIds.forEach((noteId) => {
                useScoreDocumentStore.getState().applyCommand({ type: 'toggleTie', trackId, noteId })
              })
            }
            break
          case '.':
            window.dispatchEvent(new CustomEvent('lava-toggle-dot'))
            break
          // Number keys 1-5 — duration (only when notes selected)
          case '1':
          case '2':
          case '3':
          case '4':
          case '5': {
            if (!selectedNoteIds.length || !track) break
            const durationMap = {
              '1': { durationType: 'whole', durationDivisions: useScoreDocumentStore.getState().document.divisions * 4 },
              '2': { durationType: 'half', durationDivisions: useScoreDocumentStore.getState().document.divisions * 2 },
              '3': { durationType: 'quarter', durationDivisions: useScoreDocumentStore.getState().document.divisions },
              '4': { durationType: 'eighth', durationDivisions: Math.max(1, useScoreDocumentStore.getState().document.divisions / 2) },
              '5': { durationType: 'sixteenth', durationDivisions: Math.max(1, useScoreDocumentStore.getState().document.divisions / 4) },
            } as const
            const config = durationMap[e.key as keyof typeof durationMap]
            selectedNoteIds.forEach((noteId) => {
              useScoreDocumentStore.getState().applyCommand({
                type: 'setDuration',
                trackId: track.id,
                noteId,
                durationType: config.durationType,
                durationDivisions: config.durationDivisions,
              })
            })
            break
          }
        }

        // Shift+T — triplet toggle
        if (e.shiftKey && e.key === 'T') {
          window.dispatchEvent(new CustomEvent('lava-toggle-triplet'))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
