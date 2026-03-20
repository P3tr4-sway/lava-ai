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
    if (track.isRecording) {
      updateTrack(track.id, { isRecording: false })
      onRecordStop?.(track.id)
    } else {
      if (!track.armed) return
      updateTrack(track.id, { isRecording: true })
      onRecordStart?.(track.id)
    }
  }

  return (
    <div
      className="relative flex flex-col gap-1 p-2 pl-4 border-b border-white/[0.05]"
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
                  ? 'bg-white/25 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}
            >
              M
            </button>
            <button
              onClick={() => updateTrack(track.id, { solo: !track.solo })}
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-r-md transition-colors ${
                track.solo
                  ? 'bg-white/25 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}
            >
              S
            </button>
          </div>

          {/* Arm button */}
          <button
            onClick={() => armTrack(track.id, !track.armed)}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              track.armed
                ? 'border-red-500 bg-red-500/20'
                : 'border-white/20 hover:border-white/40'
            }`}
            title={track.armed ? 'Disarm track' : 'Arm for recording'}
          >
            {track.armed && <div className="w-2 h-2 rounded-full bg-red-500" />}
          </button>

          <button className="p-0.5 text-white/40 hover:text-white/70 transition-colors">
            <MoreVertical size={12} />
          </button>
        </div>
      </div>

      {/* Volume slider + Pan */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative h-4 flex items-center">
          <div className="absolute w-full h-[3px] bg-white/15 rounded-full" />
          <div
            className="absolute h-[3px] bg-white rounded-full"
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
            className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-md pointer-events-none"
            style={{ left: `calc(${track.volume}% - 5px)` }}
          />
        </div>
        <PanKnob value={track.pan} onChange={(v) => updateTrack(track.id, { pan: v })} />
      </div>

      {/* Record button — only shown when showRecordButton is true */}
      {showRecordButton && (
        <button
          onClick={handleRecordClick}
          disabled={!track.armed && !track.isRecording}
          className={`flex items-center justify-center gap-1 w-full py-0.5 rounded text-[10px] font-medium transition-colors ${
            track.isRecording
              ? 'bg-red-500 text-white'
              : track.armed
                ? 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title={!track.armed && !track.isRecording ? 'Arm track first' : undefined}
        >
          {track.isRecording ? (
            <><Square size={8} /> Stop</>
          ) : (
            <><Circle size={8} className="text-red-400" /> Record</>
          )}
        </button>
      )}
    </div>
  )
}
