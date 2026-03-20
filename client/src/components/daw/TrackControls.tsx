import { Square, Circle, MoreVertical } from 'lucide-react'
import { PanKnob } from './PanKnob'
import type { TrackLane } from '@/stores/dawPanelStore'
import { useDawPanelStore } from '@/stores/dawPanelStore'

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
    if (track.recording || track.recordReady) {
      onRecordStop?.(track.id)
    } else {
      if (!track.recArm) {
        updateTrack(track.id, { recordBlockedReason: 'Arm track first to record.' })
        return
      }
      onRecordStart?.(track.id)
    }
  }

  return (
    <div
      className="relative flex flex-col gap-1 p-2 pl-4 border-b border-border"
      style={{ height: 88, backgroundColor: track.color.bg }}
    >
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: track.color.accent }} />

      {/* Track name row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-primary truncate">{track.name}</span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-px">
            <button
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-l-md transition-colors ${
                track.muted
                  ? 'bg-text-primary/25 text-text-primary'
                  : 'bg-text-primary/10 text-text-primary/50 hover:bg-text-primary/15'
              }`}
            >
              M
            </button>
            <button
              onClick={() => updateTrack(track.id, { solo: !track.solo })}
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-r-md transition-colors ${
                track.solo
                  ? 'bg-text-primary/25 text-text-primary'
                  : 'bg-text-primary/10 text-text-primary/50 hover:bg-text-primary/15'
              }`}
            >
              S
            </button>
            <button
              onClick={() => updateTrack(track.id, { inputMonitor: !track.inputMonitor })}
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                track.inputMonitor
                  ? 'bg-text-primary/20 text-text-primary'
                  : 'bg-text-primary/10 text-text-primary/50 hover:bg-text-primary/15'
              }`}
              title={track.inputMonitor ? 'Disable input monitoring' : 'Enable input monitoring'}
            >
              I
            </button>
          </div>

          {/* Arm button */}
          <button
            onClick={() => armTrack(track.id, !track.recArm)}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              track.recording
                ? 'border-error bg-error'
                : track.recordReady
                  ? 'border-warning bg-warning/20'
                  : track.recArm
                    ? 'border-error bg-error/20'
                    : 'border-border hover:border-border-hover'
            }`}
            title={
              track.recording
                ? 'Recording'
                : track.recordReady
                  ? 'Record ready'
                  : track.recArm
                    ? 'Disarm track'
                    : 'Arm for recording'
            }
          >
            {(track.recArm || track.recordReady || track.recording) && (
              <div
                className={`w-2 h-2 rounded-full ${
                  track.recording
                    ? 'bg-surface-0'
                    : track.recordReady
                      ? 'bg-warning'
                      : 'bg-error'
                }`}
              />
            )}
          </button>

          <button
            onClick={handleRecordClick}
            disabled={!showRecordButton}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
              track.recording
                ? 'bg-error text-surface-0'
                : track.recordReady
                  ? 'bg-warning/20 text-warning'
                  : track.recArm
                    ? 'bg-text-primary/15 text-text-primary'
                    : 'bg-text-primary/10 text-text-primary/40'
            }`}
            title={track.recordBlockedReason ?? 'Record'}
          >
            R
          </button>

          <button className="p-0.5 text-text-muted hover:text-text-secondary transition-colors">
            <MoreVertical size={12} />
          </button>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between text-[10px] text-text-muted min-h-[12px]">
        <span>
          {track.recording
            ? 'Recording...'
            : track.recordReady
              ? 'Ready to record'
              : track.recArm
                ? 'Armed'
                : 'Idle'}
        </span>
        {track.recordBlockedReason && <span className="text-warning truncate">{track.recordBlockedReason}</span>}
      </div>

      {/* Volume slider + Pan */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative h-4 flex items-center">
          <div className="absolute w-full h-[3px] bg-text-primary/15 rounded-full" />
          <div
            className="absolute h-[3px] bg-text-primary rounded-full"
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
            className="absolute w-2.5 h-2.5 bg-text-primary rounded-full shadow-md pointer-events-none"
            style={{ left: `calc(${track.volume}% - 5px)` }}
          />
        </div>
        <PanKnob value={track.pan} onChange={(v) => updateTrack(track.id, { pan: v })} />
      </div>

      {/* Record button — only shown when showRecordButton is true */}
      {showRecordButton && (
        <button
          onClick={handleRecordClick}
          disabled={!track.recArm && !track.recordReady && !track.recording}
          className={`flex items-center justify-center gap-1 w-full py-0.5 rounded text-[10px] font-medium transition-colors ${
            track.recording
              ? 'bg-error text-surface-0'
              : track.recordReady
                ? 'bg-warning/20 text-warning'
                : track.recArm
                  ? 'bg-text-primary/10 text-text-primary/60 hover:bg-text-primary/15 hover:text-text-primary/80'
                : 'bg-text-primary/5 text-text-primary/30 cursor-not-allowed'
          }`}
          title={track.recordBlockedReason ?? (!track.recArm && !track.recordReady && !track.recording ? 'Arm track first' : undefined)}
        >
          {track.recording ? (
            <><Square size={8} /> Stop</>
          ) : track.recordReady ? (
            <><Circle size={8} className="text-warning" /> Cancel</>
          ) : (
            <><Circle size={8} className="text-error" /> Record</>
          )}
        </button>
      )}
    </div>
  )
}
