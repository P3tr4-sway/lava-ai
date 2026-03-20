import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useJamStore } from '@/stores/jamStore'
import type { TrackLane } from '@/stores/jamStore'
import {
  Music,
  Play,
  Square,
  Circle,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Mic,
  Sparkles,
  Loader2,
  Library,
  ChevronRight,
  Plus,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Slider'
import { Toggle } from '@/components/ui/Toggle'
import { useUIStore } from '@/stores/uiStore'
import { LIBRARY_MODAL_ID } from '@/components/library/LibraryModal'
import { KEYS, SCALES } from '@lava/shared'

const STYLES = ['Rock', 'Jazz', 'Blues', 'Funk', 'Lo-fi', 'Latin', 'R&B', 'Electronic'] as const

const TOTAL_BARS = 16
const BEATS_PER_BAR = 4
const LOOP_BARS = 4

// Deterministic mock waveform amplitudes
const WAVEFORM_BARS = Array.from({ length: 100 }, (_, i) => {
  const t = i / 100
  const envelope = Math.sin(t * Math.PI) * 0.6 + 0.3
  const wave = Math.sin(i * 2.7) * 0.3 + Math.sin(i * 7.1) * 0.2 + Math.sin(i * 13.3) * 0.15
  return Math.max(0.08, Math.min(1, envelope * (0.5 + wave)))
})

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ── PanKnob ── */
function PanKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const delta = (dragRef.current.startY - e.clientY) * 1.5
      onChangeRef.current(Math.max(-100, Math.min(100, Math.round(dragRef.current.startValue + delta))))
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const rotation = (value / 100) * 135
  const label = value > 0 ? `R${value}` : value < 0 ? `L${Math.abs(value)}` : 'C'

  return (
    <div
      onPointerDown={(e) => {
        dragRef.current = { startY: e.clientY, startValue: value }
        e.preventDefault()
      }}
      className="w-6 h-6 rounded-full bg-white/10 border-2 border-white/20 shrink-0 flex items-center justify-center cursor-ns-resize select-none"
      title={`Pan: ${label}`}
    >
      <div
        className="w-0.5 h-[10px] bg-white/50 rounded-full"
        style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center bottom' }}
      />
    </div>
  )
}

/* ── TrackControls ── */
function TrackControls({ track, updateTrack }: { track: TrackLane; updateTrack: (id: string, changes: Partial<TrackLane>) => void }) {
  return (
    <div
      className="h-[120px] relative flex flex-col gap-1 p-3 pl-5 border-b border-white/[0.05]"
      style={{ backgroundColor: track.color.bg }}
    >
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: track.color.accent }} />

      {/* Track name row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-text-primary truncate">{track.name}</span>
        <div className="flex items-center">
          {/* Mute / Solo */}
          <div className="flex items-center gap-px">
            <button
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-l-md transition-colors ${
                track.muted
                  ? 'bg-white/25 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}
            >
              M
            </button>
            <button
              onClick={() => updateTrack(track.id, { solo: !track.solo })}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-r-md transition-colors ${
                track.solo
                  ? 'bg-white/25 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}
            >
              S
            </button>
          </div>
          <button className="ml-1 p-0.5 text-white/40 hover:text-white/70 transition-colors">
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* Volume slider + Pan */}
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 relative h-5 flex items-center">
          <div className="absolute w-full h-[4px] bg-white/15 rounded-full" />
          <div
            className="absolute h-[4px] bg-white rounded-full"
            style={{ width: `${track.volume}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={track.volume}
            onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })}
            className="absolute w-full h-5 opacity-0 cursor-pointer"
          />
          <div
            className="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
            style={{ left: `calc(${track.volume}% - 6px)` }}
          />
        </div>
        <PanKnob value={track.pan} onChange={(v) => updateTrack(track.id, { pan: v })} />
      </div>

      {/* Record button */}
      <button
        onClick={() => updateTrack(track.id, { isRecording: !track.isRecording })}
        className={`mt-1 flex items-center justify-center gap-1.5 w-full py-1 rounded text-[11px] font-medium transition-colors ${
          track.isRecording
            ? 'bg-red-500 text-white'
            : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80'
        }`}
      >
        {track.isRecording ? (
          <><Square size={10} /> Stop</>
        ) : (
          <><Circle size={10} className="text-red-400" /> Record</>
        )}
      </button>
    </div>
  )
}

/* ── TrackLaneView ── */
function TrackLaneView({ track }: { track: TrackLane }) {
  return (
    <div className="h-[120px] relative overflow-hidden border-b border-white/[0.05]">
      {/* Grid lines (vertical beat grid) */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: TOTAL_BARS }, (_, i) => (
          <div key={i} className="flex-1 min-w-[60px] border-r border-white/[0.18] flex">
            {Array.from({ length: BEATS_PER_BAR - 1 }, (_, b) => (
              <div key={b} className="flex-1 border-r border-white/[0.09]" />
            ))}
            <div className="flex-1" />
          </div>
        ))}
      </div>
      {/* Horizontal center line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.06]" />

      {/* Waveform block (visible when recording) */}
      {track.isRecording && (
        <div
          className="absolute top-2 bottom-2 left-0 rounded-2xl overflow-hidden flex items-center"
          style={{ width: `${(LOOP_BARS / TOTAL_BARS) * 100}%`, backgroundColor: track.color.accent }}
        >
          {/* Waveform bars */}
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
          <div className="flex items-center gap-2 text-white/20">
            <Mic size={16} />
            <span className="text-xs">Press Record to capture your playing</span>
          </div>
        </div>
      )}

      {/* Recording indicator pulse */}
      {track.isRecording && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] text-red-400 font-medium">REC</span>
        </div>
      )}
    </div>
  )
}

/* ── JamPage ── */
export function JamPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const bpm = useAudioStore((s) => s.bpm)
  const setBpm = useAudioStore((s) => s.setBpm)
  const key = useAudioStore((s) => s.key)
  const setKey = useAudioStore((s) => s.setKey)
  const playbackState = useAudioStore((s) => s.playbackState)
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)
  const currentTime = useAudioStore((s) => s.currentTime)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const duration = useAudioStore((s) => s.duration)
  const setDuration = useAudioStore((s) => s.setDuration)
  const metronomeEnabled = useAudioStore((s) => s.metronomeEnabled)
  const toggleMetronome = useAudioStore((s) => s.toggleMetronome)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume)

  const availableTracks = useJamStore((s) => s.availableTracks)
  const selectedTrackId = useJamStore((s) => s.selectedTrackId)
  const isRecording = useJamStore((s) => s.isRecording)
  const setRecording = useJamStore((s) => s.setRecording)
  const tracks = useJamStore((s) => s.tracks)
  const addTrack = useJamStore((s) => s.addTrack)
  const updateTrack = useJamStore((s) => s.updateTrack)
  const openModal = useUIStore((s) => s.openModal)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam', projectId: id })
  }, [id, setSpaceContext])

  const [trackPrompt, setTrackPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState<string>('Rock')

  const isPlaying = playbackState === 'playing'
  const isPaused = playbackState === 'paused'

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>()
  const playStartRef = useRef({ time: 0, position: 0 })

  const totalDuration = (TOTAL_BARS * BEATS_PER_BAR * 60) / bpm
  const playheadPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  // Set duration in audioStore for transport progress bar
  useEffect(() => {
    setDuration(totalDuration)
  }, [totalDuration, setDuration])

  // Playback animation
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }
    playStartRef.current = { time: performance.now(), position: currentTime }
    const animate = () => {
      const elapsed = (performance.now() - playStartRef.current.time) / 1000
      const newTime = playStartRef.current.position + elapsed
      if (newTime >= totalDuration) {
        setCurrentTime(0)
        setPlaybackState('stopped')
        return
      }
      setCurrentTime(newTime)
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, totalDuration, setCurrentTime, setPlaybackState])

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const container = scrollContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const totalWidth = container.scrollWidth
    const percent = x / totalWidth
    setCurrentTime(percent * totalDuration)
  }, [totalDuration, setCurrentTime])

  const handleGenerate = () => {
    if (!trackPrompt.trim() || isGenerating) return
    setIsGenerating(true)
    // TODO: wire to agent API — POST /api/agent/chat with start_jam tool
    setTimeout(() => setIsGenerating(false), 2000)
  }

  const handleSkipBack = () => {
    setCurrentTime(0)
    setPlaybackState('stopped')
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Music size={20} className="text-text-secondary" />
            <h1 className="text-xl font-semibold">Play</h1>
          </div>
          <p className="text-text-secondary text-sm">
            Free-form play with AI-generated backing tracks.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/backing-tracks')} className="gap-2">
          <Library size={14} />
          Browse Tracks
        </Button>
      </div>

      {/* ── Session Settings — compact inline toolbar strip ── */}
      <div className="bg-surface-2 border border-border rounded-md px-4 py-3 flex flex-wrap items-center gap-0">
        {/* Key */}
        <div className="flex items-center gap-2 pr-4 border-r border-border">
          <span className="text-xs text-text-muted shrink-0">Key</span>
          <div className="flex flex-wrap gap-1">
            {KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setKey(k)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  key === k
                    ? 'bg-white text-black'
                    : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* BPM */}
        <div className="flex items-center gap-3 px-4 border-r border-border">
          <span className="text-xs text-text-muted shrink-0">BPM</span>
          <span className="text-sm font-medium text-text-primary tabular-nums w-8 text-center">{bpm}</span>
          <div className="w-28">
            <Slider
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </div>
          <Toggle
            checked={metronomeEnabled}
            onChange={toggleMetronome}
            label="Met."
          />
        </div>

        {/* Style */}
        <div className="flex items-center gap-2 pl-4">
          <span className="text-xs text-text-muted shrink-0">Style</span>
          <div className="flex flex-wrap gap-1">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStyle(s)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedStyle === s
                    ? 'bg-white text-black'
                    : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Backing Track — transport-first layout ── */}
      <div className="bg-surface-2 border border-border rounded-md flex flex-col">
        {/* Transport bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={handleSkipBack}>
              <SkipBack size={14} />
            </Button>
            <Button
              size="icon"
              onClick={() =>
                setPlaybackState(isPlaying ? 'paused' : 'playing')
              }
              className={isPlaying ? 'ring-1 ring-white/20' : ''}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPlaybackState('stopped')}
              disabled={!isPlaying && !isPaused}
            >
              <Square size={14} />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled>
              <SkipForward size={14} />
            </Button>
          </div>

          {/* Progress bar + time display */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[11px] text-text-muted tabular-nums w-8 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/60 rounded-full transition-[width] duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-text-muted tabular-nums w-8 shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 w-28">
            <Volume2 size={14} className="text-text-secondary shrink-0" />
            <Slider
              min={0}
              max={100}
              value={Math.round(masterVolume * 100)}
              onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Library selector */}
        <button
          onClick={() => openModal(LIBRARY_MODAL_ID)}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition-colors text-left w-full group"
        >
          <div className="flex-1 min-w-0">
            {selectedTrackId ? (
              (() => {
                const track = availableTracks.find((t) => t.id === selectedTrackId)
                return track ? (
                  <>
                    <p className="text-sm font-medium text-text-primary truncate">{track.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {track.genre} &middot; {track.key} &middot; {track.bpm} BPM
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-secondary">Browse Library</p>
                )
              })()
            ) : (
              <>
                <p className="text-sm text-text-secondary">Browse Library</p>
                <p className="text-[11px] text-text-muted">
                  Pick from drum grooves, melodic loops, backing tracks, or AI generations
                </p>
              </>
            )}
          </div>
          <ChevronRight size={14} className="text-text-muted group-hover:text-text-secondary transition-colors shrink-0" />
        </button>

        <div className="border-t border-border" />

        {/* AI generate — compact command-bar style */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Sparkles size={14} className="text-text-muted shrink-0" />
          <input
            type="text"
            placeholder='Describe a backing track... e.g. "chill jazz trio in Dm"'
            value={trackPrompt}
            onChange={(e) => setTrackPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleGenerate()
              }
            }}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!trackPrompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              'Generate'
            )}
          </Button>
        </div>
      </div>

      {/* ── Recording — DAW Arrangement View ── */}
      <div className="bg-surface-3 rounded-md overflow-hidden border border-border">
        <div className="flex">
          {/* Left column — fixed width, no scroll */}
          <div className="w-44 shrink-0 flex flex-col border-r border-border">
            {/* Timeline spacer with + button */}
            <div className="h-8 flex items-center pl-2 border-b border-white/[0.05]">
              <button
                onClick={addTrack}
                className="w-6 h-6 rounded bg-surface-4 hover:bg-white/[0.12] text-text-muted hover:text-text-secondary flex items-center justify-center transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {/* Track controls */}
            {tracks.map((track) => (
              <TrackControls key={track.id} track={track} updateTrack={updateTrack} />
            ))}
          </div>

          {/* Right column — single overflow-x-auto container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto relative"
            onClick={handleTimelineClick}
          >
            <div style={{ minWidth: `${TOTAL_BARS * 60}px` }} className="relative">
              {/* Timeline ruler */}
              <div className="flex h-8 min-w-0 border-b border-white/[0.05]">
                {Array.from({ length: TOTAL_BARS }, (_, i) => (
                  <div
                    key={i}
                    className="relative flex-1 min-w-[60px] border-r border-white/[0.18]"
                  >
                    {/* Loop region highlight */}
                    {i < LOOP_BARS && (
                      <div className="absolute inset-0 bg-white/[0.08]" />
                    )}
                    {/* Beat subdivision lines */}
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: BEATS_PER_BAR - 1 }, (_, b) => (
                        <div key={b} className="flex-1 border-r border-white/[0.09]" />
                      ))}
                      <div className="flex-1" />
                    </div>
                    {/* Bar number */}
                    <span className={`absolute left-1.5 top-1 text-[11px] font-medium tabular-nums ${
                      i < LOOP_BARS ? 'text-text-primary' : 'text-white/30'
                    }`}>
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* Track lanes */}
              {tracks.map((track) => (
                <TrackLaneView key={track.id} track={track} />
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                style={{ left: `${playheadPercent}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-3 h-2 bg-red-500" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
                <div className="w-px flex-1 bg-red-500/90" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
