import { useEffect } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { useAgentPanelControls } from './useAgentPanelControls'

export function useKeyboardShortcuts() {
  const { canShowPanel, togglePanel } = useAgentPanelControls()
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)
  const playbackState = useAudioStore((s) => s.playbackState)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === ' ') {
        e.preventDefault()
        setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing')
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (!canShowPanel) return
        e.preventDefault()
        togglePanel()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canShowPanel, togglePanel, setPlaybackState, playbackState])
}
