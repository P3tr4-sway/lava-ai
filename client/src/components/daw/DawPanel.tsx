import { useEffect, useRef, useState } from 'react'
import {
  Play,
  SkipBack,
  Square,
  Volume2,
  ChevronDown,
  ChevronUp,
  Plus,
  Circle,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Slider } from '@/components/ui/Slider'
import {
  useAudioStore,
  type RecordMode,
  type TransportState,
} from '@/stores/audioStore'
import { useDawPanelStore } from '@/stores/dawPanelStore'
import { useDawResize } from './useDawResize'
import { TrackControls } from './TrackControls'
import { TrackLaneView } from './TrackLaneView'
import type { TrackLane } from '@/stores/dawPanelStore'
import { BAR_WIDTH_PX } from '@/audio/constants'
import { ToneEngine } from '@/audio/ToneEngine'
import { Recorder } from '@/audio/Recorder'
import { audioService } from '@/services/audioService'
import type { Clip } from '@/audio/types'
import { useDawKeyboardShortcuts } from '@/hooks/useDawKeyboardShortcuts'

const TOTAL_BARS = 16
const BEATS_PER_BAR = 4

const ACTIVE_RECORD_STATES: TransportState[] = [
  'count_in',
  'pre_roll',
  'recording',
  'auto_punch_wait_in',
  'auto_punch_recording',
]

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function barsToSeconds(bar: number, bpm: number, beatsPerBar: number) {
  return bar * beatsPerBar * (60 / bpm)
}

function isRunningState(state: TransportState) {
  return state !== 'stopped' && state !== 'paused' && state !== 'locating'
}

function isCaptureState(state: TransportState) {
  return state === 'recording' || state === 'auto_punch_recording'
}

interface RecordSession {
  trackId: string
  tempClipId: string
  recordPassId: string
  startBar: number
  bpm: number
  phase: 'queued' | 'recording'
  fileName: string
  recordMode: Clip['recordMode']
}

export interface DawSectionLabel {
  label: string
  type: string
  barStart: number
  barCount: number
}

export interface DawPanelProps {
  tracks: TrackLane[]
  onUpdateTrack: (id: string, changes: Partial<TrackLane>) => void
  onAddTrack: () => void
  onRemoveTrack?: (id: string) => void
  totalBars?: number
  beatsPerBar?: number
  showRecordButton?: boolean
  showTransportBar?: boolean
  className?: string
  sections?: DawSectionLabel[]
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
  const transportState = useAudioStore((s) => s.transportState)
  const setTransportState = useAudioStore((s) => s.setTransportState)
  const recordMode = useAudioStore((s) => s.recordMode)
  const setRecordMode = useAudioStore((s) => s.setRecordMode)
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
  const metronomeMode = useAudioStore((s) => s.metronomeMode)
  const cycleMetronomeMode = useAudioStore((s) => s.cycleMetronomeMode)
  const metronomeBeat = useAudioStore((s) => s.metronomeBeat)
  const countInBars = useAudioStore((s) => s.countInBars)
  const preRollBars = useAudioStore((s) => s.preRollBars)
  const autoReturn = useAudioStore((s) => s.autoReturn)
  const setAutoReturn = useAudioStore((s) => s.setAutoReturn)
  const transportOriginBar = useAudioStore((s) => s.transportOriginBar)
  const setTransportOriginBar = useAudioStore((s) => s.setTransportOriginBar)
  const pendingRecordStartBar = useAudioStore((s) => s.pendingRecordStartBar)
  const setPendingRecordStartBar = useAudioStore((s) => s.setPendingRecordStartBar)
  const punchRange = useAudioStore((s) => s.punchRange)
  const setPunchRange = useAudioStore((s) => s.setPunchRange)
  const togglePunchRange = useAudioStore((s) => s.togglePunchRange)

  const snapEnabled = useDawPanelStore((s) => s.snapEnabled)
  const toggleSnap = useDawPanelStore((s) => s.toggleSnap)
  const armTrack = useDawPanelStore((s) => s.armTrack)
  const selectedClipId = useDawPanelStore((s) => s.selectedClipId)
  const selectClip = useDawPanelStore((s) => s.selectClip)
  const updateClip = useDawPanelStore((s) => s.updateClip)
  const addClip = useDawPanelStore((s) => s.addClip)
  const removeClip = useDawPanelStore((s) => s.removeClip)

  const scrollRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef(new Recorder())
  const recordSessionRef = useRef<RecordSession | null>(null)
  const prevTransportStateRef = useRef<TransportState>(transportState)
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [beatFlash, setBeatFlash] = useState(false)

  // Flash beat indicator on each metronome tick
  useEffect(() => {
    if (metronomeMode === 'off' || metronomeBeat === 0) return
    setBeatFlash(true)
    const t = setTimeout(() => setBeatFlash(false), 80)
    return () => clearTimeout(t)
  }, [metronomeBeat, metronomeMode])

  useDawKeyboardShortcuts()

  const isPlaying = playbackState === 'playing'
  const isCollapsed = size === 'collapsed'
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const playheadLeft = currentBar * BAR_WIDTH_PX
  const countdownBeats =
    pendingRecordStartBar !== null && ACTIVE_RECORD_STATES.includes(transportState)
      ? Math.max(1, Math.ceil((pendingRecordStartBar - currentBar) * beatsPerBar))
      : 0
  const transportRecordIntent = tracks.some((track) => track.recordReady || track.recording || track.recArm)

  const handleDropAudioFile = async (trackId: string, file: File, atBar: number) => {
    try {
      const track = tracks.find((candidate) => candidate.id === trackId)
      if (!track) return

      const audioFile = await audioService.upload(file)
      const engine = ToneEngine.getInstance()
      const audioBuffer = await engine.loadBuffer(audioFile.id)
      if (!audioBuffer) return

      const clipWidthInBars = audioBuffer.duration * (bpm / 60) / beatsPerBar
      const clip: Clip = {
        id: crypto.randomUUID(),
        trackId,
        startBar: atBar,
        lengthInBars: clipWidthInBars,
        trimStart: 0,
        trimEnd: 0,
        audioFileId: audioFile.id,
        committedAudioFileId: audioFile.id,
        audioBuffer,
        name: file.name.replace(/\.[^.]+$/, ''),
        color: track.color.accent,
        status: 'committed',
      }

      addClip(trackId, clip)
    } catch (err) {
      console.error('Drop audio file failed:', err)
    }
  }

  const clearTrackRecordState = (trackId: string, hasRecording = false, error?: string | null) => {
    onUpdateTrack(trackId, {
      recordReady: false,
      recording: false,
      hasRecording: hasRecording || tracks.find((track) => track.id === trackId)?.hasRecording,
      recordBlockedReason: error ?? null,
    })
  }

  const finishRecordSession = async (reason: 'stopped' | 'cancelled') => {
    const session = recordSessionRef.current
    if (!session) return

    recordSessionRef.current = null
    setRecordingTrackId(null)
    setPendingRecordStartBar(null)

    const recorder = recorderRef.current

    if (reason === 'cancelled' || session.phase === 'queued' || !recorder.isRecording) {
      removeClip(session.trackId, session.tempClipId)
      clearTrackRecordState(session.trackId, false)
      return
    }

    try {
      const { blob, audioBuffer } = await recorder.stop()
      const file = new File([blob], `${session.fileName}.webm`, { type: blob.type || 'audio/webm' })
      const uploaded = await audioService.upload(file)
      const committedLengthInBars = audioBuffer.duration * (session.bpm / 60) / beatsPerBar

      updateClip(session.trackId, session.tempClipId, {
        audioBuffer,
        audioFileId: uploaded.id,
        committedAudioFileId: uploaded.id,
        name: session.fileName,
        lengthInBars: Math.max(0.25, committedLengthInBars),
        status: 'committed',
        errorMessage: undefined,
      })
      clearTrackRecordState(session.trackId, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      updateClip(session.trackId, session.tempClipId, {
        status: 'temp',
        errorMessage: message,
      })
      clearTrackRecordState(session.trackId, false, message)
    }
  }

  useEffect(() => {
    const previous = prevTransportStateRef.current
    const session = recordSessionRef.current

    if (
      session &&
      ACTIVE_RECORD_STATES.includes(previous) &&
      !ACTIVE_RECORD_STATES.includes(transportState)
    ) {
      void finishRecordSession(isCaptureState(previous) ? 'stopped' : 'cancelled')
    }

    prevTransportStateRef.current = transportState
  }, [transportState])

  useEffect(() => {
    let cancelled = false
    const session = recordSessionRef.current

    if (!session || session.phase === 'recording' || !isCaptureState(transportState)) {
      return
    }

    const startRecording = async () => {
      await recorderRef.current.start(session.trackId, session.startBar)
      if (cancelled) return

      session.phase = 'recording'
      onUpdateTrack(session.trackId, {
        recordReady: false,
        recording: true,
        recordBlockedReason: null,
      })
      updateClip(session.trackId, session.tempClipId, {
        status: 'recording',
      })
    }

    void startRecording()

    return () => {
      cancelled = true
    }
  }, [transportState, onUpdateTrack, updateClip])

  useEffect(() => {
    const session = recordSessionRef.current
    if (!session || session.phase !== 'recording') return
    const { trackId, tempClipId, startBar } = session  // capture before any async

    const clipLength = Math.max(0.25, currentBar - startBar)
    updateClip(trackId, tempClipId, {
      lengthInBars: clipLength,
      status: 'recording',
    })
  }, [currentBar, updateClip])

  useEffect(() => {
    return () => {
      recorderRef.current.stopStream()
    }
  }, [])

  const handleRecordStart = async (trackId: string) => {
    if (recordingTrackId && recordingTrackId !== trackId) {
      onUpdateTrack(trackId, { recordBlockedReason: 'Only one track can record at a time.' })
      return
    }

    const track = tracks.find((candidate) => candidate.id === trackId)
    if (!track) return

    const permission = await recorderRef.current.requestPermission()
    if (permission === 'denied') {
      onUpdateTrack(trackId, { recordBlockedReason: 'Microphone permission denied.' })
      return
    }

    const nowBar = currentBar
    const startBar = punchRange.enabled ? Math.max(nowBar, punchRange.start) : nowBar
    const recordPassId = crypto.randomUUID()
    const tempClipId = `rec-${recordPassId}`
    const fileName = `Recording ${new Date().toLocaleTimeString()}`
    const clipRecordMode: Clip['recordMode'] =
      punchRange.enabled && startBar > nowBar
        ? 'punch_in'
        : recordMode

    recordSessionRef.current = {
      trackId,
      tempClipId,
      recordPassId,
      startBar,
      bpm,
      phase: 'queued',
      fileName,
      recordMode: clipRecordMode,
    }

    setRecordingTrackId(trackId)
    setPendingRecordStartBar(startBar)
    addClip(trackId, {
      id: tempClipId,
      trackId,
      startBar,
      lengthInBars: 1,
      trimStart: 0,
      trimEnd: 0,
      name: fileName,
      color: track.color.accent,
      status: 'temp',
      recordPassId,
      recordMode: clipRecordMode,
    })

    onUpdateTrack(trackId, {
      recordReady: true,
      recording: false,
      recordBlockedReason: null,
    })

    let transportStartBar = nowBar
    let nextTransportState: TransportState = 'recording'

    if (recordMode === 'count_in' && countInBars > 0) {
      transportStartBar = Math.max(0, startBar - countInBars)
      nextTransportState = 'count_in'
      setTransportOriginBar(startBar)
    } else if (recordMode === 'pre_roll' && preRollBars > 0) {
      transportStartBar = Math.max(0, startBar - preRollBars)
      nextTransportState = 'pre_roll'
      setTransportOriginBar(startBar)
    } else if (punchRange.enabled && startBar > nowBar) {
      nextTransportState = 'auto_punch_wait_in'
      setTransportOriginBar(nowBar)
    } else if (punchRange.enabled) {
      nextTransportState = 'auto_punch_recording'
      setTransportOriginBar(nowBar)
    } else {
      nextTransportState = 'recording'
      setTransportOriginBar(nowBar)
    }

    if (transportStartBar !== nowBar) {
      setCurrentBar(transportStartBar)
      setCurrentTime(barsToSeconds(transportStartBar, bpm, beatsPerBar))
    }

    setTransportState(nextTransportState)
  }

  const handleRecordStop = () => {
    setTransportState('stopped')
  }

  const locateToBar = (barIndex: number) => {
    const nextTime = barsToSeconds(barIndex, bpm, beatsPerBar)
    if (isRunningState(transportState)) {
      const resumeState: TransportState =
        isCaptureState(transportState) ? transportState : 'rolling'
      setTransportState('locating')
      setCurrentBar(barIndex)
      setCurrentTime(nextTime)
      setTimeout(() => setTransportState(resumeState), 0)
    } else {
      setCurrentBar(barIndex)
      setCurrentTime(nextTime)
    }
  }

  const handlePlay = () => {
    if (isRunningState(transportState)) return
    setTransportOriginBar(currentBar)
    setPendingRecordStartBar(null)
    setTransportState('rolling')
  }

  const handleStop = () => {
    setTransportState('stopped')
    setPendingRecordStartBar(null)
  }

  const handleReturnToStart = () => {
    setTransportOriginBar(0)
    setPendingRecordStartBar(null)
    setCurrentBar(0)
    setCurrentTime(0)
    setTransportState('stopped')
  }

  const handleBarClick = (barIndex: number) => {
    locateToBar(barIndex)
    onBarClick?.(barIndex)
  }

  const toggleRecordMode = (mode: RecordMode) => {
    setRecordMode(recordMode === mode ? 'immediate' : mode)
  }

  const handlePunchToggle = () => {
    if (!punchRange.enabled) {
      const start = Math.floor(currentBar)
      setPunchRange({
        start,
        end: Math.min(totalBars, start + 4),
        enabled: true,
      })
      return
    }

    togglePunchRange()
  }

  const handleTransportRecord = () => {
    if (isCaptureState(transportState)) {
      handleRecordStop()
      return
    }
    if (ACTIVE_RECORD_STATES.includes(transportState)) {
      handleStop()
      return
    }
    if (tracks.length === 0) return

    const armedTrack = tracks.find((t) => t.recArm)
    if (armedTrack) {
      void handleRecordStart(armedTrack.id)
    } else {
      const firstTrack = tracks[0]
      armTrack(firstTrack.id, true)
      setTimeout(() => void handleRecordStart(firstTrack.id), 0)
    }
  }

  return (
    <div
      className={cn('shrink-0 flex flex-col bg-surface-0 border-t border-border overflow-hidden', className)}
      style={{ height }}
    >
      <div
        {...handleProps}
        className="shrink-0 h-4 flex items-center justify-center cursor-ns-resize group select-none"
        title="Drag to resize"
      >
        <div className="w-8 h-1 rounded-full bg-border group-hover:bg-text-muted transition-colors" />
      </div>

      {showTransportBar && (
        <div className="shrink-0 flex flex-col border-b border-border">
          {/* Primary transport row */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleReturnToStart}
                className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                title="Return to beginning"
              >
                <SkipBack size={13} />
              </button>
              <button
                onClick={handleStop}
                className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                title="Stop"
              >
                <Square size={13} />
              </button>
              <button
                onClick={handlePlay}
                disabled={isRunningState(transportState)}
                className="w-8 h-8 rounded-full bg-text-primary text-surface-0 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-40"
                title="Play"
              >
                <Play size={14} className="ml-0.5" />
              </button>
              <button
                onClick={handleTransportRecord}
                disabled={tracks.length === 0}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30',
                  isCaptureState(transportState)
                    ? 'bg-error text-surface-0 animate-pulse'
                    : ACTIVE_RECORD_STATES.includes(transportState)
                      ? 'bg-surface-3 text-warning'
                      : transportRecordIntent
                        ? 'bg-surface-3 text-error border border-border-hover hover:bg-surface-4'
                        : 'bg-surface-3 text-text-muted hover:text-text-secondary hover:bg-surface-4',
                )}
                title="Record"
              >
                <Circle size={14} className={cn(
                  (isCaptureState(transportState) || transportRecordIntent) && 'fill-current',
                )} />
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-text-muted">BPM</span>
              <input
                type="number"
                value={bpm}
                onChange={(e) => {
                  if (e.target.value.includes('.')) return
                  const value = Number.parseInt(e.target.value, 10)
                  if (!Number.isNaN(value) && value >= 40 && value <= 240) {
                    setBpm(value)
                  }
                }}
                className="w-12 bg-transparent text-center text-xs text-text-primary/80 border-b border-border focus:outline-none focus:border-border-hover"
                min={40}
                max={240}
                step="1"
              />
            </div>

            <button
              onClick={toggleLoop}
              className={cn(
                'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                loop.enabled
                  ? 'bg-text-primary/20 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
              )}
              title="Loop"
            >
              Loop
            </button>
            <button
              onClick={cycleMetronomeMode}
              className={cn(
                'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                metronomeMode !== 'off'
                  ? 'bg-text-primary/20 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
              )}
              title="Toggle metronome click"
            >
              Click
            </button>
            {metronomeMode !== 'off' && (
              <div className="flex items-center gap-1" aria-label="Beat indicator">
                {Array.from({ length: beatsPerBar }, (_, i) => {
                  const activeBeat = metronomeBeat > 0 ? (metronomeBeat - 1) % beatsPerBar : -1
                  const isActive = beatFlash && i === activeBeat
                  const isDownbeat = i === 0
                  return (
                    <div
                      key={i}
                      className={cn(
                        'rounded-full transition-all duration-75',
                        isActive
                          ? isDownbeat
                            ? 'w-2.5 h-2.5 bg-text-primary'
                            : 'w-2 h-2 bg-text-secondary'
                          : isDownbeat
                            ? 'w-2.5 h-2.5 bg-surface-4'
                            : 'w-2 h-2 bg-surface-3',
                      )}
                    />
                  )
                })}
              </div>
            )}
            <button
              onClick={toggleSnap}
              className={cn(
                'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                snapEnabled
                  ? 'bg-text-primary/20 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
              )}
              title="Snap to beat"
            >
              Snap
            </button>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                'p-1.5 rounded transition-colors',
                showAdvanced
                  ? 'bg-surface-3 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
              )}
              title="Recording options"
            >
              <SlidersHorizontal size={12} />
            </button>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] text-text-muted tabular-nums shrink-0">{formatTime(currentTime)}</span>
              <div
                className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden cursor-pointer group/prog relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  locateToBar((pct * duration) / (beatsPerBar * (60 / bpm)))
                }}
              >
                <div
                  className="h-full bg-text-primary rounded-full transition-[width] duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] text-text-muted tabular-nums shrink-0">{formatTime(duration)}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 w-20">
              <Volume2 size={13} className="text-text-muted shrink-0" />
              <Slider
                min={0}
                max={100}
                value={Math.round(masterVolume * 100)}
                onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
              />
            </div>

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
          </div>

          {/* Secondary row — recording options */}
          {showAdvanced && (
            <div className="flex items-center gap-2 px-3 py-1 border-t border-border animate-fade-in">
              <div
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium',
                  isCaptureState(transportState)
                    ? 'bg-error text-surface-0'
                    : ACTIVE_RECORD_STATES.includes(transportState)
                      ? 'bg-surface-3 text-warning'
                      : transportRecordIntent
                        ? 'bg-surface-3 text-text-secondary'
                        : 'bg-surface-2 text-text-muted',
                )}
              >
                <Circle size={8} className={cn(isCaptureState(transportState) && 'animate-pulse')} />
                <span>
                  {isCaptureState(transportState)
                    ? 'REC'
                    : ACTIVE_RECORD_STATES.includes(transportState)
                      ? 'READY'
                      : 'IDLE'}
                </span>
              </div>

              <button
                onClick={() => toggleRecordMode('count_in')}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  recordMode === 'count_in'
                    ? 'bg-warning/20 text-warning'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
                )}
                title={`Count-in (${countInBars} bar)`}
              >
                Count-in
              </button>
              <button
                onClick={() => toggleRecordMode('pre_roll')}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  recordMode === 'pre_roll'
                    ? 'bg-warning/20 text-warning'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
                )}
                title={`Pre-roll (${preRollBars} bar)`}
              >
                Pre-roll
              </button>
              <button
                onClick={handlePunchToggle}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  punchRange.enabled
                    ? 'bg-warning/20 text-warning'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
                )}
                title="Punch range"
              >
                Punch
              </button>
              <button
                onClick={() => setAutoReturn(!autoReturn)}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  autoReturn
                    ? 'bg-text-primary/20 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
                )}
                title="Auto return to record/play origin on stop"
              >
                Return
              </button>
            </div>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="flex-1 overflow-hidden flex flex-col bg-surface-2/30">
          <div className="flex flex-1 overflow-hidden">
            <div className="w-40 shrink-0 flex flex-col border-r border-border overflow-y-auto">
              <div className="h-7 flex items-center px-2 border-b border-white/[0.05] shrink-0">
                <button
                  onClick={onAddTrack}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
                >
                  <Plus size={11} />
                  Add track
                </button>
                <button
                  onClick={expand}
                  className="ml-auto p-0.5 text-text-muted hover:text-text-secondary transition-colors"
                  title="Expand fully"
                >
                  <ChevronUp size={11} />
                </button>
              </div>

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

            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
              <div style={{ minWidth: `${totalBars * BAR_WIDTH_PX}px` }} className="relative">
                <div className="flex h-7 border-b border-border sticky top-0 z-10 bg-surface-1">
                  {Array.from({ length: totalBars }, (_, index) => (
                    <div
                      key={index}
                      className="relative shrink-0 border-r border-border cursor-pointer hover:bg-text-primary/[0.06] transition-colors"
                      style={{ width: BAR_WIDTH_PX }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const fraction = (e.clientX - rect.left) / BAR_WIDTH_PX
                        const barPos = snapEnabled
                          ? index
                          : index + Math.max(0, Math.min(fraction, 0.999))
                        handleBarClick(barPos)
                      }}
                      title={`Jump to bar ${index + 1}`}
                    >
                      {loop.enabled && index >= loop.start && index < loop.end && (
                        <div className="absolute inset-0 bg-text-primary/[0.06]" />
                      )}
                      {punchRange.enabled && index >= punchRange.start && index < punchRange.end && (
                        <div className="absolute inset-0 bg-warning/12" />
                      )}
                      <span className="absolute left-1 top-1 text-[10px] tabular-nums text-text-muted">
                        {index + 1}
                      </span>
                    </div>
                  ))}

                  {loop.enabled && (
                    <>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-text-primary/70 pointer-events-none z-20"
                        style={{ left: loop.start * BAR_WIDTH_PX }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-text-primary/70 pointer-events-none z-20"
                        style={{ left: loop.end * BAR_WIDTH_PX }}
                      />
                    </>
                  )}

                  {punchRange.enabled && (
                    <>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-warning pointer-events-none z-20"
                        style={{ left: punchRange.start * BAR_WIDTH_PX }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-warning pointer-events-none z-20"
                        style={{ left: punchRange.end * BAR_WIDTH_PX }}
                      />
                    </>
                  )}
                </div>

                {sections && sections.length > 0 && (
                  <div
                    className="relative flex-shrink-0 border-b border-white/[0.05] bg-surface-1/30 overflow-hidden"
                    style={{ height: 20, minWidth: totalBars * BAR_WIDTH_PX }}
                  >
                    {sections.map((section, index) => {
                      const sectionColors: Record<string, string> = {
                        intro: 'bg-blue-500/20 text-blue-300',
                        verse: 'bg-green-500/20 text-green-300',
                        chorus: 'bg-orange-500/20 text-orange-300',
                        bridge: 'bg-yellow-500/20 text-yellow-300',
                        outro: 'bg-red-500/20 text-red-300',
                        custom: 'bg-surface-3 text-text-secondary',
                      }
                      const colorClass = sectionColors[section.type] ?? sectionColors.custom
                      return (
                        <div
                          key={index}
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
                    recorder={track.id === recordingTrackId ? recorderRef.current : undefined}
                  />
                ))}

                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `${playheadLeft}px` }}
                >
                  {countdownBeats > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-semibold whitespace-nowrap">
                      {`Count ${countdownBeats}`}
                    </div>
                  )}
                  <div
                    className={cn(
                      'w-2 h-2 -ml-1',
                      isCaptureState(transportState)
                        ? 'bg-error'
                        : ACTIVE_RECORD_STATES.includes(transportState)
                          ? 'bg-warning'
                          : 'bg-red-500',
                    )}
                    style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
                  />
                  <div
                    className={cn(
                      'w-px h-full',
                      isCaptureState(transportState)
                        ? 'bg-error/80'
                        : ACTIVE_RECORD_STATES.includes(transportState)
                          ? 'bg-warning/80'
                          : 'bg-red-500/80',
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
