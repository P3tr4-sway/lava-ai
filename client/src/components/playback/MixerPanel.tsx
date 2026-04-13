/**
 * MixerPanel — per-track volume/mute/solo controls.
 *
 * Reads from usePlaybackStore and forwards changes to the Player via
 * an imperative ref so callers don't need to prop-drill deeply.
 */

import type React from 'react'
import { Button } from '@/components/ui'
import { Slider } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { usePlaybackStore } from '../../stores/playbackStore'
import type { Player } from '../../playback/player'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TrackInfo {
  index: number
  name: string
}

interface MixerPanelProps {
  tracks: TrackInfo[]
  playerRef: React.RefObject<Player | null>
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MixerPanel({ tracks, playerRef, className }: MixerPanelProps) {
  const trackVolumes = usePlaybackStore((s) => s.trackVolumes)
  const trackMuted = usePlaybackStore((s) => s.trackMuted)
  const trackSoloed = usePlaybackStore((s) => s.trackSoloed)

  const handleVolumeChange = (index: number, vol: number) => {
    usePlaybackStore.getState().setTrackVolume(index, vol)
    playerRef.current?.setTrackVolume(index, vol)
  }

  const handleMuteToggle = (index: number) => {
    const next = !trackMuted[index]
    usePlaybackStore.getState().setTrackMuted(index, next)
    playerRef.current?.setTrackMute(index, next)
  }

  const handleSoloToggle = (index: number) => {
    const next = !trackSoloed[index]
    usePlaybackStore.getState().setTrackSoloed(index, next)
    playerRef.current?.setTrackSolo(index, next)
  }

  if (tracks.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {tracks.map((track) => {
        const vol = trackVolumes[track.index] ?? 1
        const muted = trackMuted[track.index] ?? false
        const soloed = trackSoloed[track.index] ?? false

        return (
          <div key={track.index} className="flex items-center gap-3 px-3 py-2">
            {/* Track name */}
            <span className="w-24 shrink-0 truncate text-sm text-text-primary">
              {track.name}
            </span>

            {/* Mute */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleMuteToggle(track.index)}
              className={cn(
                'shrink-0 text-xs font-semibold',
                muted && 'bg-surface-3 text-warning',
              )}
              aria-label={muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
              aria-pressed={muted}
            >
              M
            </Button>

            {/* Solo */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleSoloToggle(track.index)}
              className={cn(
                'shrink-0 text-xs font-semibold',
                soloed && 'bg-surface-3 text-accent',
              )}
              aria-label={soloed ? `Unsolo ${track.name}` : `Solo ${track.name}`}
              aria-pressed={soloed}
            >
              S
            </Button>

            {/* Volume */}
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={vol}
              onChange={(e) => handleVolumeChange(track.index, Number(e.target.value))}
              aria-label={`${track.name} volume`}
              className="flex-1"
            />

            {/* Numeric read-out */}
            <span className="w-8 shrink-0 text-right text-xs text-text-muted">
              {Math.round(vol * 100)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
