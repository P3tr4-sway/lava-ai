import { useEffect } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'

export function usePlaybackStateBridge(enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const syncFromAudio = () => {
      const audio = useAudioStore.getState()
      const editor = useEditorStore.getState()

      if (editor.currentBar !== audio.currentBar) {
        editor.setCurrentBar(audio.currentBar)
      }

      if (editor.playbackState !== audio.playbackState) {
        editor.setPlaybackState(audio.playbackState)
      }
    }

    syncFromAudio()

    const unsubscribe = useAudioStore.subscribe((state, previousState) => {
      if (
        state.currentBar === previousState.currentBar
        && state.playbackState === previousState.playbackState
      ) {
        return
      }

      syncFromAudio()
    })

    return unsubscribe
  }, [enabled])
}
