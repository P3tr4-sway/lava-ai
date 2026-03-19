import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useJamStore } from '@/stores/jamStore'
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
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Slider'
import { Toggle } from '@/components/ui/Toggle'
import { useUIStore } from '@/stores/uiStore'
import { LIBRARY_MODAL_ID } from '@/components/library/LibraryModal'
import { KEYS, SCALES } from '@lava/shared'

const STYLES = ['Rock', 'Jazz', 'Blues', 'Funk', 'Lo-fi', 'Latin', 'R&B', 'Electronic'] as const

export function JamPage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const bpm = useAudioStore((s) => s.bpm)
  const setBpm = useAudioStore((s) => s.setBpm)
  const key = useAudioStore((s) => s.key)
  const setKey = useAudioStore((s) => s.setKey)
  const playbackState = useAudioStore((s) => s.playbackState)
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)
  const metronomeEnabled = useAudioStore((s) => s.metronomeEnabled)
  const toggleMetronome = useAudioStore((s) => s.toggleMetronome)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume)

  const availableTracks = useJamStore((s) => s.availableTracks)
  const selectedTrackId = useJamStore((s) => s.selectedTrackId)
  const isRecording = useJamStore((s) => s.isRecording)
  const setRecording = useJamStore((s) => s.setRecording)
  const openModal = useUIStore((s) => s.openModal)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam', projectId: id })
  }, [id, setSpaceContext])

  const [trackPrompt, setTrackPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const isPlaying = playbackState === 'playing'
  const isPaused = playbackState === 'paused'

  const handleGenerate = () => {
    if (!trackPrompt.trim() || isGenerating) return
    setIsGenerating(true)
    // TODO: wire to agent API — POST /api/agent/chat with start_jam tool
    setTimeout(() => setIsGenerating(false), 2000)
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Music size={20} className="text-text-secondary" />
          <h1 className="text-xl font-semibold">Jam</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Free-form play with AI-generated backing tracks.
        </p>
      </div>

      {/* ── TOP: Key / BPM / Style ── */}
      <Card className="flex flex-col gap-4">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Session Settings
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Key */}
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Key</label>
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
          <div>
            <Slider
              label={`Tempo: ${bpm} BPM`}
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
            <div className="flex items-center gap-3 mt-2">
              <Toggle
                checked={metronomeEnabled}
                onChange={toggleMetronome}
                label="Metronome"
              />
            </div>
          </div>

          {/* Style */}
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Style</label>
            <div className="flex flex-wrap gap-1">
              {STYLES.map((s) => (
                <button
                  key={s}
                  className="px-2 py-1 text-xs rounded bg-surface-3 text-text-secondary hover:bg-surface-4 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── MIDDLE: Backing Track Player + Loop Controls ── */}
      <Card className="flex flex-col gap-4">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Backing Track
        </p>

        {/* AI Generate */}
        <div className="flex flex-col gap-2">
          <textarea
            placeholder={"Describe a backing track…\ne.g. \"chill jazz trio in Dm\" or \"up-tempo funk groove with slap bass\""}
            value={trackPrompt}
            onChange={(e) => setTrackPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleGenerate()
              }
            }}
            rows={3}
            className="w-full rounded bg-surface-3 border border-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover focus:bg-surface-4 transition-colors resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={!trackPrompt.trim() || isGenerating}
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {isGenerating ? 'Generating…' : 'Generate Track'}
            </Button>
          </div>
        </div>

        {/* Track Selection — click to open Library */}
        <button
          onClick={() => openModal(LIBRARY_MODAL_ID)}
          className="flex items-center gap-3 px-4 py-3 rounded border border-border bg-surface-3 hover:bg-surface-4 hover:border-border-hover transition-colors text-left w-full group"
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

        {/* Transport */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm">
              <SkipBack size={14} />
            </Button>
            <Button
              size="icon"
              onClick={() =>
                setPlaybackState(isPlaying ? 'paused' : 'playing')
              }
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
            <Button variant="ghost" size="icon-sm">
              <SkipForward size={14} />
            </Button>
          </div>

          {/* Progress bar placeholder */}
          <div className="flex-1 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-white/60 rounded-full w-0" />
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
      </Card>

      {/* ── BOTTOM: Recording ── */}
      <Card className="flex flex-col gap-3">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Recording
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant={isRecording ? 'destructive' : 'outline'}
            onClick={() => setRecording(!isRecording)}
            className="gap-2"
          >
            {isRecording ? (
              <>
                <Square size={14} /> Stop Recording
              </>
            ) : (
              <>
                <Circle size={14} className="text-red-500" /> Record
              </>
            )}
          </Button>

          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-400 font-medium">Recording…</span>
            </div>
          )}
        </div>

        {/* Recording waveform placeholder */}
        <div className="h-20 bg-surface-3/50 rounded border border-dashed border-border flex items-center justify-center">
          <div className="flex items-center gap-2 text-text-muted">
            <Mic size={16} />
            <span className="text-xs">
              {isRecording ? 'Listening…' : 'Press Record to capture your playing'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
