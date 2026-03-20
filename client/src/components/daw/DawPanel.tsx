import { useRef } from 'react'
import {
  Play, Pause, SkipBack, Square, Volume2, ChevronDown, ChevronUp, Plus,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Slider } from '@/components/ui/Slider'
import { useAudioStore } from '@/stores/audioStore'
import { useDawResize } from './useDawResize'
import { TrackControls } from './TrackControls'
import { TrackLaneView } from './TrackLaneView'
import type { TrackLane } from '@/stores/dawPanelStore'

const TOTAL_BARS = 16
const BEATS_PER_BAR = 4
const LOOP_BARS = 4

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface DawPanelProps {
  tracks: TrackLane[]
  onUpdateTrack: (id: string, changes: Partial<TrackLane>) => void
  onAddTrack: () => void
  onRemoveTrack?: (id: string) => void
  totalBars?: number
  beatsPerBar?: number
  showRecordButton?: boolean
  /** Hide the transport bar row — used when the page provides its own transport */
  showTransportBar?: boolean
  className?: string
}

export function DawPanel({
  tracks,
  onUpdateTrack,
  onAddTrack,
  totalBars = TOTAL_BARS,
  beatsPerBar = BEATS_PER_BAR,
  showRecordButton = false,
  showTransportBar = true,
  className,
}: DawPanelProps) {
  const { height, size, collapse, expand, resetDefault, handleProps } = useDawResize()

  const playbackState = useAudioStore((s) => s.playbackState)
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)
  const currentTime = useAudioStore((s) => s.currentTime)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const duration = useAudioStore((s) => s.duration)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume)

  const bpm = useAudioStore((s) => s.bpm)

  const scrollRef = useRef<HTMLDivElement>(null)
  const isPlaying = playbackState === 'playing'
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const playheadPercent = progressPercent
  const isCollapsed = size === 'collapsed'

  return (
    <div
      className={cn('shrink-0 flex flex-col bg-surface-0 border-t border-border overflow-hidden', className)}
      style={{ height }}
    >
      {/* ── Drag handle ──────────────────────────────────────────── */}
      <div
        {...handleProps}
        className="shrink-0 h-4 flex items-center justify-center cursor-ns-resize group select-none"
        title="Drag to resize"
      >
        <div className="w-8 h-1 rounded-full bg-border group-hover:bg-text-muted transition-colors" />
      </div>

      {/* ── Transport bar ────────────────────────────────────────── */}
      {showTransportBar && <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border">
        {/* Playback controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { setCurrentTime(0); setPlaybackState('stopped') }}
            className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <SkipBack size={13} />
          </button>
          <button
            onClick={() => setPlaybackState(isPlaying ? 'paused' : 'playing')}
            className="w-8 h-8 rounded-full bg-text-primary text-surface-0 flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <button
            onClick={() => setPlaybackState('stopped')}
            className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <Square size={13} />
          </button>
        </div>

        {/* Progress bar + time */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[11px] text-text-muted tabular-nums shrink-0">{formatTime(currentTime)}</span>
          <div
            className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden cursor-pointer group/prog relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              setCurrentTime(pct * duration)
            }}
          >
            <div
              className="h-full bg-text-primary rounded-full transition-[width] duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-text-primary opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${progressPercent}%`, transform: `translateX(-50%) translateY(-50%)` }}
            />
          </div>
          <span className="text-[11px] text-text-muted tabular-nums shrink-0">{formatTime(duration)}</span>
        </div>

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-1.5 w-20">
          <Volume2 size={13} className="text-text-muted shrink-0" />
          <Slider
            min={0}
            max={100}
            value={Math.round(masterVolume * 100)}
            onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
          />
        </div>

        {/* Collapse / expand toggle */}
        <button
          onClick={() => {
            if (isCollapsed) resetDefault()
            else collapse()
          }}
          className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
          title={isCollapsed ? 'Expand DAW' : 'Collapse DAW'}
        >
          {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>}

      {/* ── Track area (hidden when collapsed) ───────────────────── */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden flex flex-col bg-surface-2/30">
          <div className="flex flex-1 overflow-hidden">
            {/* Left: track controls */}
            <div className="w-40 shrink-0 flex flex-col border-r border-border overflow-y-auto">
              {/* Add track row */}
              <div className="h-7 flex items-center px-2 border-b border-white/[0.05] shrink-0">
                <button
                  onClick={onAddTrack}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
                >
                  <Plus size={11} />
                  Add track
                </button>
                {/* Expand fully button */}
                <button
                  onClick={expand}
                  className="ml-auto p-0.5 text-text-muted hover:text-text-secondary transition-colors"
                  title="Expand fully"
                >
                  <ChevronUp size={11} />
                </button>
              </div>
              {tracks.map((track) => (
                <TrackControls
                  key={track.id}
                  track={track}
                  updateTrack={onUpdateTrack}
                  showRecordButton={showRecordButton}
                />
              ))}
            </div>

            {/* Right: lanes + timeline */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
              <div style={{ minWidth: `${totalBars * 48}px` }} className="relative">
                {/* Timeline ruler */}
                <div className="flex h-7 border-b border-white/[0.05] sticky top-0 z-10 bg-surface-1">
                  {Array.from({ length: totalBars }, (_, i) => (
                    <div
                      key={i}
                      className="relative flex-1 min-w-[48px] border-r border-white/[0.18] cursor-pointer hover:bg-white/[0.06] transition-colors"
                      onClick={() => setCurrentTime(i * beatsPerBar * (60 / bpm))}
                      title={`Jump to bar ${i + 1}`}
                    >
                      {i < LOOP_BARS && (
                        <div className="absolute inset-0 bg-white/[0.06]" />
                      )}
                      <span className={`absolute left-1 top-1 text-[10px] tabular-nums ${
                        i < LOOP_BARS ? 'text-text-primary' : 'text-white/30'
                      }`}>
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Track lanes */}
                {tracks.map((track) => (
                  <TrackLaneView
                    key={track.id}
                    track={track}
                    totalBars={totalBars}
                    beatsPerBar={beatsPerBar}
                    loopBars={LOOP_BARS}
                    playheadPercent={playheadPercent}
                  />
                ))}

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `${playheadPercent}%` }}
                >
                  <div className="w-2 h-2 bg-red-500 mx-auto" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
                  <div className="w-px flex-1 bg-red-500/80 mx-auto h-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
