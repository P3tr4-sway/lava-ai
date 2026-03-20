import { useRef } from 'react'
import {
  Play, Pause, SkipBack, Square, Volume2, ChevronDown, ChevronUp, Plus,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Slider } from '@/components/ui/Slider'
import { useAudioStore } from '@/stores/audioStore'
import { useDawPanelStore } from '@/stores/dawPanelStore'
import { useDawResize } from './useDawResize'
import { TrackControls } from './TrackControls'
import { TrackLaneView } from './TrackLaneView'
import type { TrackLane } from '@/stores/dawPanelStore'
import { BAR_WIDTH_PX } from '@/audio/constants'
import { AudioEngine } from '@/audio/AudioEngine'
import { generatePeakData } from '@/audio/waveform'
import { Recorder } from '@/audio/Recorder'
import { audioService } from '@/services/audioService'
import type { Clip } from '@/audio/types'
import { useDawKeyboardShortcuts } from '@/hooks/useDawKeyboardShortcuts'

const TOTAL_BARS = 16
const BEATS_PER_BAR = 4
const LOOP_BARS = 4

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface DawSectionLabel {
  label: string
  type: string  // 'intro' | 'verse' | 'chorus' | etc.
  barStart: number   // 该段落从第几 bar 开始
  barCount: number   // 该段落有几个 bar
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
  /** Optional Lead Sheet section labels displayed between ruler and track lanes */
  sections?: DawSectionLabel[]
  /** Called when user clicks a bar on the ruler */
  onBarClick?: (bar: number) => void
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
  sections,
  onBarClick,
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
  const setBpm = useAudioStore((s) => s.setBpm)
  const currentBar = useAudioStore((s) => s.currentBar)
  const setCurrentBar = useAudioStore((s) => s.setCurrentBar)
  const loop = useAudioStore((s) => s.loop)
  const toggleLoop = useAudioStore((s) => s.toggleLoop)
  const metronomeEnabled = useAudioStore((s) => s.metronomeEnabled)
  const toggleMetronome = useAudioStore((s) => s.toggleMetronome)

  const snapEnabled = useDawPanelStore((s) => s.snapEnabled)
  const toggleSnap = useDawPanelStore((s) => s.toggleSnap)
  const selectedClipId = useDawPanelStore((s) => s.selectedClipId)
  const selectClip = useDawPanelStore((s) => s.selectClip)
  const updateClip = useDawPanelStore((s) => s.updateClip)
  const addClip = useDawPanelStore((s) => s.addClip)

  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Recorder ───────────────────────────────────────────────────────────────
  const recorderRef = useRef<Recorder>(new Recorder())
  const recordStartBarRef = useRef<number>(0)

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useDawKeyboardShortcuts()

  // ── Audio file drop handler ────────────────────────────────────────────────
  const handleDropAudioFile = async (trackId: string, file: File, atBar: number) => {
    try {
      const track = tracks.find((t) => t.id === trackId)
      if (!track) return

      // 1. Upload file to server
      const audioFile = await audioService.upload(file)

      // 2. Load and decode AudioBuffer via engine (uses the returned file id)
      const engine = AudioEngine.getInstance()
      const audioBuffer = await engine.loadBuffer(audioFile.id)

      // 3. Generate peak data for waveform display
      const clipWidthInBars = audioBuffer.duration * (bpm / 60) / beatsPerBar
      const targetSamples = Math.round(clipWidthInBars * BAR_WIDTH_PX)
      const peakData = generatePeakData(audioBuffer, Math.max(targetSamples, 1))

      // 4. Build Clip object
      const clip: Clip = {
        id: crypto.randomUUID(),
        trackId,
        startBar: atBar,
        lengthInBars: clipWidthInBars,
        trimStart: 0,
        trimEnd: 0,
        audioFileId: audioFile.id,
        audioBuffer,
        peakData,
        name: file.name.replace(/\.[^.]+$/, ''),
        color: track.color.accent,
      }

      // 5. Add to store
      addClip(trackId, clip)
    } catch (err) {
      console.error('Drop audio file failed:', err)
    }
  }

  // ── Recording handlers ─────────────────────────────────────────────────────
  const handleRecordStart = async (trackId: string) => {
    const recorder = recorderRef.current
    const permission = await recorder.requestPermission()
    if (permission === 'denied') {
      console.warn('Microphone permission denied')
      return
    }
    const currentBar = useAudioStore.getState().currentBar
    recordStartBarRef.current = currentBar
    await recorder.start(trackId, currentBar)
  }

  const handleRecordStop = async (trackId: string) => {
    const recorder = recorderRef.current
    if (!recorder.isRecording) return

    try {
      const { audioBuffer } = await recorder.stop()
      const { bpm: currentBpm } = useAudioStore.getState()

      const clipLengthInBars = audioBuffer.duration * (currentBpm / 60) / beatsPerBar
      const targetSamples = Math.round(clipLengthInBars * BAR_WIDTH_PX)
      const peakData = generatePeakData(audioBuffer, Math.max(targetSamples, 1))

      const startBar = recordStartBarRef.current
      const track = tracks.find((t) => t.id === trackId)

      const clip: Clip = {
        id: crypto.randomUUID(),
        trackId,
        startBar,
        lengthInBars: clipLengthInBars,
        trimStart: 0,
        trimEnd: 0,
        audioBuffer,
        peakData,
        name: `Recording ${new Date().toLocaleTimeString()}`,
        color: track?.color.accent ?? '#60a5fa',
      }
      addClip(trackId, clip)
    } catch (err) {
      console.error('Recording failed:', err)
    }
  }
  const isPlaying = playbackState === 'playing'
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const isCollapsed = size === 'collapsed'

  // Playhead position based on bar (px), not percentage
  const playheadLeft = currentBar * BAR_WIDTH_PX

  // Handle bar click on ruler
  const handleBarClick = (barIndex: number) => {
    const barDuration = beatsPerBar * (60 / bpm)
    setCurrentTime(barIndex * barDuration)
    setCurrentBar(barIndex)
    onBarClick?.(barIndex)
  }

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
            onClick={() => { setCurrentTime(0); setCurrentBar(0); setPlaybackState('stopped') }}
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

        {/* BPM editable input */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-text-muted">BPM</span>
          <input
            type="number"
            value={bpm}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (v >= 40 && v <= 240) setBpm(v)
            }}
            className="w-12 bg-transparent text-center text-xs text-white/80 border-b border-white/20 focus:outline-none focus:border-white/60"
            min={40}
            max={240}
          />
        </div>

        {/* Loop toggle */}
        <button
          onClick={toggleLoop}
          className={`p-1.5 rounded text-xs transition-colors ${
            loop.enabled ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'
          }`}
          title="Loop"
        >
          ⟳
        </button>

        {/* Metronome toggle */}
        <button
          onClick={toggleMetronome}
          className={`p-1.5 rounded text-xs transition-colors ${
            metronomeEnabled ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'
          }`}
          title="Metronome"
        >
          ♩
        </button>

        {/* Snap toggle */}
        <button
          onClick={toggleSnap}
          className={`p-1.5 rounded text-xs transition-colors ${
            snapEnabled ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'
          }`}
          title="Snap to beat"
        >
          ⌶
        </button>

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

              {/* Spacer for sections row if visible */}
              {sections && sections.length > 0 && (
                <div className="shrink-0 border-b border-white/[0.05]" style={{ height: 20 }} />
              )}

              {tracks.map((track) => (
                <TrackControls
                  key={track.id}
                  track={track}
                  updateTrack={onUpdateTrack}
                  showRecordButton={showRecordButton}
                  onRecordStart={handleRecordStart}
                  onRecordStop={handleRecordStop}
                />
              ))}
            </div>

            {/* Right: lanes + timeline */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
              <div style={{ minWidth: `${totalBars * BAR_WIDTH_PX}px` }} className="relative">

                {/* Timeline ruler */}
                <div className="flex h-7 border-b border-white/[0.05] sticky top-0 z-10 bg-surface-1">
                  {Array.from({ length: totalBars }, (_, i) => (
                    <div
                      key={i}
                      className="relative flex-1 min-w-[48px] border-r border-white/[0.18] cursor-pointer hover:bg-white/[0.06] transition-colors"
                      onClick={() => handleBarClick(i)}
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

                  {/* Loop markers on ruler */}
                  {loop.enabled && (
                    <>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60 pointer-events-none z-20"
                        style={{ left: loop.start * BAR_WIDTH_PX }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60 pointer-events-none z-20"
                        style={{ left: loop.end * BAR_WIDTH_PX }}
                      />
                    </>
                  )}
                </div>

                {/* Lead Sheet segment labels row — only when sections prop has content */}
                {sections && sections.length > 0 && (
                  <div
                    className="relative flex-shrink-0 border-b border-white/[0.05] bg-surface-1/30 overflow-hidden"
                    style={{ height: 20, minWidth: totalBars * BAR_WIDTH_PX }}
                  >
                    {sections.map((section, i) => {
                      const sectionColors: Record<string, string> = {
                        intro: 'bg-blue-500/20 text-blue-300',
                        verse: 'bg-green-500/20 text-green-300',
                        chorus: 'bg-purple-500/20 text-purple-300',
                        bridge: 'bg-orange-500/20 text-orange-300',
                        outro: 'bg-red-500/20 text-red-300',
                        custom: 'bg-gray-500/20 text-gray-300',
                      }
                      const colorClass = sectionColors[section.type] ?? sectionColors.custom
                      return (
                        <div
                          key={i}
                          className={`absolute inset-y-0 flex items-center px-1 text-[9px] font-medium overflow-hidden border-r border-white/10 ${colorClass}`}
                          style={{
                            left: section.barStart * BAR_WIDTH_PX,
                            width: section.barCount * BAR_WIDTH_PX,
                          }}
                          title={section.label}
                        >
                          {section.label}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Track lanes */}
                {tracks.map((track) => (
                  <TrackLaneView
                    key={track.id}
                    track={track}
                    totalBars={totalBars}
                    beatsPerBar={beatsPerBar}
                    currentBar={currentBar}
                    selectedClipId={selectedClipId}
                    snapEnabled={snapEnabled}
                    onClipSelect={selectClip}
                    onClipMove={(clipId, newStartBar) => updateClip(track.id, clipId, { startBar: newStartBar })}
                    onClipResizeRight={(clipId, newLengthInBars) => updateClip(track.id, clipId, { lengthInBars: newLengthInBars })}
                    onClipResizeLeft={(clipId, newTrimStart, newStartBar) => updateClip(track.id, clipId, { trimStart: newTrimStart, startBar: newStartBar })}
                    onDropAudioFile={(file, atBar) => handleDropAudioFile(track.id, file, atBar)}
                  />
                ))}

                {/* Playhead — bar-based px position */}
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `${playheadLeft}px` }}
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
