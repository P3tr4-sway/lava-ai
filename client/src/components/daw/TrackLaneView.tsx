import { Mic } from 'lucide-react'
import type { TrackLane } from '@/stores/dawPanelStore'

const WAVEFORM_BARS = Array.from({ length: 100 }, (_, i) => {
  const t = i / 100
  const envelope = Math.sin(t * Math.PI) * 0.6 + 0.3
  const wave = Math.sin(i * 2.7) * 0.3 + Math.sin(i * 7.1) * 0.2 + Math.sin(i * 13.3) * 0.15
  return Math.max(0.08, Math.min(1, envelope * (0.5 + wave)))
})

interface TrackLaneViewProps {
  track: TrackLane
  totalBars: number
  beatsPerBar: number
  loopBars: number
  playheadPercent: number
}

export function TrackLaneView({ track, totalBars, beatsPerBar, loopBars, playheadPercent }: TrackLaneViewProps) {
  return (
    <div className="h-[88px] relative overflow-hidden border-b border-white/[0.05]">
      {/* Grid lines */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: totalBars }, (_, i) => (
          <div key={i} className="flex-1 min-w-[48px] border-r border-white/[0.18] flex">
            {Array.from({ length: beatsPerBar - 1 }, (_, b) => (
              <div key={b} className="flex-1 border-r border-white/[0.09]" />
            ))}
            <div className="flex-1" />
          </div>
        ))}
      </div>
      <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.06]" />

      {/* Waveform block */}
      {track.isRecording && (
        <div
          className="absolute top-1.5 bottom-1.5 left-0 rounded-xl overflow-hidden flex items-center"
          style={{ width: `${(loopBars / totalBars) * 100}%`, backgroundColor: track.color.accent }}
        >
          <svg className="w-full h-[65%]" preserveAspectRatio="none" viewBox="0 0 100 100">
            {WAVEFORM_BARS.map((amp, i) => {
              const barH = amp * 100
              const y = (100 - barH) / 2
              return (
                <rect
                  key={i}
                  x={i}
                  y={y}
                  width={0.6}
                  height={barH}
                  fill="rgba(255,255,255,0.55)"
                  rx={0.3}
                />
              )
            })}
          </svg>
        </div>
      )}

      {/* Empty state */}
      {!track.isRecording && !track.hasRecording && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-1.5 text-white/20">
            <Mic size={13} />
            <span className="text-[11px]">Empty track</span>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {track.isRecording && (
        <div className="absolute top-1.5 right-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-red-400 font-medium">REC</span>
        </div>
      )}

      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-px bg-red-400/70 pointer-events-none z-10"
        style={{ left: `${playheadPercent}%` }}
      />
    </div>
  )
}
