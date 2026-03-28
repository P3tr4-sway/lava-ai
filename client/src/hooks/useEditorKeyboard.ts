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

      // Tool shortcuts (single letter, no modifier)
      if (!meta && !e.altKey) {
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
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
