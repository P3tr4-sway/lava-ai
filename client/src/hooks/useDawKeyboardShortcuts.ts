import { useEffect } from 'react'
import { useDawPanelStore } from '../stores/dawPanelStore'
import { useAudioStore } from '../stores/audioStore'

export function useDawKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore keypresses inside input fields / editable elements
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // S — split selected clip at the current playhead bar
      if (e.key === 's' || e.key === 'S') {
        const { selectedClipId, tracks, splitClip } = useDawPanelStore.getState()
        const { currentBar } = useAudioStore.getState()
        if (!selectedClipId) return
        const track = tracks.find((t) => t.clips.some((c) => c.id === selectedClipId))
        if (track) {
          e.preventDefault()
          splitClip(track.id, selectedClipId, currentBar)
        }
      }

      // Delete / Backspace — remove selected clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedClipId, tracks, removeClip, selectClip } = useDawPanelStore.getState()
        if (!selectedClipId) return
        const track = tracks.find((t) => t.clips.some((c) => c.id === selectedClipId))
        if (track) {
          e.preventDefault()
          removeClip(track.id, selectedClipId)
          selectClip(null)
        }
      }

      // Escape — deselect clip
      if (e.key === 'Escape') {
        const { selectClip } = useDawPanelStore.getState()
        selectClip(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // empty deps: store.getState() avoids stale closures
}
