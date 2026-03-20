import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useJamStore } from '@/stores/jamStore'
import { useDawPanelStore, makeTrack } from '@/stores/dawPanelStore'
import {
  Music,
  Play,
  Square,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Sparkles,
  Loader2,
  Library,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Slider'
import { Toggle } from '@/components/ui/Toggle'
import { useUIStore } from '@/stores/uiStore'
import { LIBRARY_MODAL_ID } from '@/components/library/LibraryModal'
import { KEYS, SCALES } from '@lava/shared'
import { DawPanel } from '@/components/daw/DawPanel'

const STYLES = ['Rock', 'Jazz', 'Blues', 'Funk', 'Lo-fi', 'Latin', 'R&B', 'Electronic'] as const

const TOTAL_BARS = 16
const BEATS_PER_BAR = 4

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

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

  // DAW Panel tracks
  const dawTracks = useDawPanelStore((s) => s.tracks)
  const setDawTracks = useDawPanelStore((s) => s.setTracks)
  const addDawTrack = useDawPanelStore((s) => s.addTrack)
  const updateDawTrack = useDawPanelStore((s) => s.updateTrack)

  const openModal = useUIStore((s) => s.openModal)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam', projectId: id })
  }, [id, setSpaceContext])

  // Seed default tracks for jam session
  useEffect(() => {
    setDawTracks([
      makeTrack('Drums', 0),
      makeTrack('Bass', 1),
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [trackPrompt, setTrackPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState<string>('Rock')

  const isPlaying = playbackState === 'playing'
  const isPaused = playbackState === 'paused'

  const animRef = useRef<number>()
  const playStartRef = useRef({ time: 0, position: 0 })

  const totalDuration = (TOTAL_BARS * BEATS_PER_BAR * 60) / bpm

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

  const handleGenerate = () => {
    if (!trackPrompt.trim() || isGenerating) return
    setIsGenerating(true)
    setTimeout(() => setIsGenerating(false), 2000)
  }

  const handleSkipBack = () => {
    setCurrentTime(0)
    setPlaybackState('stopped')
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="h-full flex flex-col">

      {/* ── Scrollable session area ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
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

          {/* ── Session Settings ── */}
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
                        ? 'bg-accent text-surface-0'
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
                        ? 'bg-accent text-surface-0'
                        : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Backing Track ── */}
          <div className="bg-surface-2 border border-border rounded-md flex flex-col">
            {/* Mini transport */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={handleSkipBack}>
                  <SkipBack size={14} />
                </Button>
                <Button
                  size="icon"
                  onClick={() => setPlaybackState(isPlaying ? 'paused' : 'playing')}
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

              <div className="flex-1 flex items-center gap-2">
                <span className="text-[11px] text-text-muted tabular-nums w-8 text-right shrink-0">
                  {formatTime(currentTime)}
                </span>
                <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-text-primary/60 rounded-full transition-[width] duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] text-text-muted tabular-nums w-8 shrink-0">
                  {formatTime(duration)}
                </span>
              </div>

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

            {/* AI generate */}
            <div className="flex items-center gap-2 px-4 py-3">
              <Sparkles size={14} className="text-text-muted shrink-0" />
              <input
                type="text"
                placeholder='Describe a backing track... e.g. "chill jazz trio in Dm"'
                value={trackPrompt}
                onChange={(e) => setTrackPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleGenerate() }
                }}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={!trackPrompt.trim() || isGenerating}
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : 'Generate'}
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* ── DAW Panel ── fixed at bottom ────────────────────────── */}
      <DawPanel
        tracks={dawTracks}
        onUpdateTrack={updateDawTrack}
        onAddTrack={() => addDawTrack()}
        showRecordButton={true}
        totalBars={TOTAL_BARS}
        beatsPerBar={BEATS_PER_BAR}
      />
    </div>
  )
}
