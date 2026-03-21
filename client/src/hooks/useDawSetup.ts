import { useEffect } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { useDawPanelStore, makeTrack } from '@/stores/dawPanelStore'

interface UseDawSetupOptions {
  initTrackName: string
  initDuration: number
  /** When this value changes, tracks and duration are re-seeded (e.g. chart?.id) */
  resetKey?: string
}

export function useDawSetup({ initTrackName, initDuration, resetKey }: UseDawSetupOptions) {
  const tracks = useDawPanelStore((s) => s.tracks)
  const setTracks = useDawPanelStore((s) => s.setTracks)
  const addTrack = useDawPanelStore((s) => s.addTrack)
  const updateTrack = useDawPanelStore((s) => s.updateTrack)
  const setDuration = useAudioStore((s) => s.setDuration)

  // Re-seed tracks and duration when resetKey changes (or on mount when resetKey is undefined)
  useEffect(() => {
    setTracks([makeTrack(initTrackName, 0)])
    setDuration(initDuration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const committedClipIds = tracks
    .flatMap((t) => t.clips.filter((c) => c.status === 'committed').map((c) => c.id))
    .join(',')
  const hasCommittedClips = committedClipIds.length > 0

  return { tracks, addTrack, updateTrack, committedClipIds, hasCommittedClips }
}
