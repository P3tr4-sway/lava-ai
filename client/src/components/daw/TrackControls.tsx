import { Square, Circle } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { PanKnob } from './PanKnob'
import type { TrackLane } from '@/stores/dawPanelStore'
import { useDawPanelStore } from '@/stores/dawPanelStore'
import { TRACK_HEIGHT_PX } from '@/audio/constants'

// When recording controls are shown we need extra room for the record button row
const HEIGHT_WITH_REC = 88

interface TrackControlsProps {
  track: TrackLane
  updateTrack: (id: string, changes: Partial<TrackLane>) => void
  showRecordButton?: boolean
  onRecordStart?: (trackId: string) => void
  onRecordStop?: (trackId: string) => void
}

export function TrackControls({
  track,
  updateTrack,
  showRecordButton = false,
  onRecordStart,
  onRecordStop,
}: TrackControlsProps) {
  const armTrack = useDawPanelStore((s) => s.armTrack)

  const handleRecordClick = () => {
    if (!showRecordButton) return
    if (track.recording || track.recordReady) {
      onRecordStop?.(track.id)
    } else {
      if (!track.recArm) {
        updateTrack(track.id, { recordBlockedReason: 'Arm the track first.' })
        return
      }
      onRecordStart?.(track.id)
    }
  }

  const height = showRecordButton ? HEIGHT_WITH_REC : TRACK_HEIGHT_PX

  return (
    <div
      className="relative flex flex-col justify-center gap-2 pl-4 pr-2 py-2 border-b border-border"
      style={{ height, backgroundColor: track.color.bg }}
    >
      {/* Color accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-sm" style={{ backgroundColor: track.color.accent }} />

      {/* Row 1 — name + M / S + arm */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="flex-1 text-xs font-semibold text-white truncate min-w-0">{track.name}</span>

        {/* Mute */}
        <button
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
          title={track.muted ? 'Unmute' : 'Mute'}
          className={cn(
            'w-[22px] h-[18px] rounded text-[10px] font-bold transition-colors',
            track.muted
              ? 'bg-warning text-surface-0'
              : 'bg-white/15 text-white/60 hover:bg-white/25 hover:text-white/90',
          )}
        >
          M
        </button>

        {/* Solo */}
        <button
          onClick={() => updateTrack(track.id, { solo: !track.solo })}
          title={track.solo ? 'Unsolo' : 'Solo'}
          className={cn(
            'w-[22px] h-[18px] rounded text-[10px] font-bold transition-colors',
            track.solo
              ? 'bg-success text-surface-0'
              : 'bg-white/15 text-white/60 hover:bg-white/25 hover:text-white/90',
          )}
        >
          S
        </button>

        {/* Arm — only in record-capable panels */}
        {showRecordButton && (
          <button
            onClick={() => armTrack(track.id, !track.recArm)}
            title={track.recArm ? 'Disarm' : 'Arm for recording'}
            className={cn(
              'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors',
              track.recording
                ? 'border-error bg-error'
                : track.recArm
                  ? 'border-error bg-error/20'
                  : 'border-border hover:border-border-hover',
            )}
          >
            {(track.recArm || track.recording) && (
              <div className={cn('w-1.5 h-1.5 rounded-full', track.recording ? 'bg-surface-0' : 'bg-error')} />
            )}
          </button>
        )}
      </div>

      {/* Row 2 — volume slider + pan */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative h-4 flex items-center">
          <div className="absolute w-full h-[2px] bg-white/20 rounded-full" />
          <div
            className="absolute h-[2px] bg-white/70 rounded-full"
            style={{ width: `${track.volume}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={track.volume}
            onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })}
            className="absolute w-full h-4 opacity-0 cursor-pointer"
          />
          <div
            className="absolute w-2 h-2 bg-white rounded-full shadow-sm pointer-events-none"
            style={{ left: `calc(${track.volume}% - 4px)` }}
          />
        </div>
        <PanKnob value={track.pan} onChange={(v) => updateTrack(track.id, { pan: v })} />
      </div>

      {/* Row 3 — record button (only when showRecordButton) */}
      {showRecordButton && (
        <button
          onClick={handleRecordClick}
          disabled={!track.recArm && !track.recordReady && !track.recording}
          title={track.recordBlockedReason ?? undefined}
          className={cn(
            'flex items-center justify-center gap-1 w-full h-5 rounded text-[10px] font-medium transition-colors',
            track.recording
              ? 'bg-error/20 text-error'
              : track.recordReady
                ? 'bg-warning/20 text-warning'
                : track.recArm
                  ? 'bg-text-primary/10 text-text-primary/70 hover:bg-text-primary/15 hover:text-text-primary'
                  : 'text-text-primary/25 cursor-not-allowed',
          )}
        >
          {track.recording ? (
            <><Square size={8} /> Stop</>
          ) : track.recordReady ? (
            <><Circle size={8} className="text-warning" /> Cancel</>
          ) : (
            <><Circle size={8} className="text-error/60" /> Record</>
          )}
        </button>
      )}

      {/* Record blocked warning */}
      {track.recordBlockedReason && (
        <span className="text-[9px] text-warning truncate leading-none">{track.recordBlockedReason}</span>
      )}
    </div>
  )
}
