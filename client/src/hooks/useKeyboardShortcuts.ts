import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAudioStore } from '@/stores/audioStore'

export function useKeyboardShortcuts() {
  const toggleAgentPanel = useUIStore((s) => s.toggleAgentPanel)
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
        e.preventDefault()
        toggleAgentPanel()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleAgentPanel, setPlaybackState, playbackState])
}
