import { useEffect } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'

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
        const selected = useEditorStore.getState().selectedBars
        if (selected.length > 0) {
          e.preventDefault()
          useEditorStore.getState().clearSelection()
        }
        return
      }

      // Cmd+C — copy
      if (meta && e.key === 'c') {
        window.dispatchEvent(new CustomEvent('lava-copy'))
        return
      }
      // Cmd+V — paste
      if (meta && e.key === 'v') {
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
        // Arrow up/down — pitch step (only when notes selected)
        if (!meta && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          const { selectedNotes } = useEditorStore.getState()
          if (selectedNotes.length > 0) {
            e.preventDefault()
            const direction = e.key === 'ArrowUp' ? 1 : -1
            const steps = e.shiftKey ? direction * 7 : direction
            window.dispatchEvent(new CustomEvent('lava-pitch-step', { detail: { steps } }))
          }
          return
        }

        switch (e.key.toLowerCase()) {
          case 'v':
            useEditorStore.getState().setToolMode('pointer')
            break
          case 'c':
            useEditorStore.getState().setToolMode('chord')
            break
          case 't':
            useEditorStore.getState().setToolMode('text')
            break
          case 'r': {
            // Toggle rest when notes are selected; otherwise toggle range tool
            const { selectedNotes, toolMode, setToolMode } = useEditorStore.getState()
            if (selectedNotes.length > 0) {
              window.dispatchEvent(new CustomEvent('lava-toggle-rest'))
            } else {
              setToolMode(toolMode === 'range' ? 'pointer' : 'range')
            }
            break
          }
          case 'k':
            useEditorStore.getState().setToolMode(
              useEditorStore.getState().toolMode === 'keySig' ? 'pointer' : 'keySig'
            )
            break
          case 'f': {
            const { selectedNotes } = useEditorStore.getState()
            if (selectedNotes.length > 0) window.dispatchEvent(new CustomEvent('lava-open-fretboard'))
            break
          }
          case 'd': {
            const { selectedNotes } = useEditorStore.getState()
            if (selectedNotes.length > 0) window.dispatchEvent(new CustomEvent('lava-open-duration'))
            break
          }
          case '#':
            window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'sharp' } }))
            break
          case 'b': {
            const { selectedNotes } = useEditorStore.getState()
            if (selectedNotes.length > 0)
              window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'flat' } }))
            break
          }
          case 'n': {
            const { selectedNotes } = useEditorStore.getState()
            if (selectedNotes.length > 0)
              window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: 'natural' } }))
            break
          }
          case 'l':
            window.dispatchEvent(new CustomEvent('lava-toggle-tie'))
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
            const { selectedNotes } = useEditorStore.getState()
            if (selectedNotes.length > 0)
              window.dispatchEvent(new CustomEvent('lava-duration-key', { detail: { key: e.key } }))
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
