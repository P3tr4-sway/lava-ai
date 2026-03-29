import { useEditorStore } from '@/stores/editorStore'

type GetMeasureBounds = (barIndex: number) => { x: number; y: number; width: number; height: number } | null

interface PlaybackCursorState {
  visible: boolean
  bounds: { x: number; y: number; width: number; height: number } | null
}

/**
 * Derives playback cursor position from editorStore.
 * `getMeasureBounds` is the function returned by useScoreSync.
 */
export function usePlaybackCursor(getMeasureBounds: GetMeasureBounds): PlaybackCursorState {
  const currentBar = useEditorStore((s) => s.currentBar)
  const playbackState = useEditorStore((s) => s.playbackState)

  const isActive = playbackState !== 'stopped' && currentBar >= 0
  if (!isActive) return { visible: false, bounds: null }

  const bounds = getMeasureBounds(currentBar)
  if (!bounds) return { visible: false, bounds: null }

  return { visible: true, bounds }
}
