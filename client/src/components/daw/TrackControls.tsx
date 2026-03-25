import { Circle } from 'lucide-react'
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

  const handleRecordEnableClick = () => {
    if (!showRecordButton) return
    // Toggle arm state only — actual recording is triggered from the transport bar
    armTrack(track.id, !track.recArm)
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

      {/* Row 3 — record enable toggle (only when showRecordButton) */}
      {showRecordButton && (
        <button
          onClick={handleRecordEnableClick}
          title={track.recording ? 'Recording…' : track.recArm ? 'Disable recording' : 'Enable recording'}
          className={cn(
            'flex items-center justify-center gap-1 w-full h-5 rounded text-[10px] font-medium transition-colors',
            track.recording
              ? 'bg-error/20 text-error'
              : track.recArm
                ? 'bg-error/15 text-error hover:bg-error/10'
                : 'bg-text-primary/10 text-text-primary/70 hover:bg-text-primary/15 hover:text-text-primary',
          )}
        >
          {track.recording ? (
            <><Circle size={8} className="fill-current animate-pulse" /> Recording</>
          ) : track.recArm ? (
            <><Circle size={8} className="text-error fill-current" /> Enabled</>
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
