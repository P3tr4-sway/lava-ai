import { create } from 'zustand'

export type PlaybackState = 'stopped' | 'playing' | 'paused'
export type TransportState =
  | 'stopped'
  | 'rolling'
  | 'count_in'
  | 'pre_roll'
  | 'record_armed'
  | 'recording'
  | 'auto_punch_wait_in'
  | 'auto_punch_recording'
  | 'loop_wrap'
  | 'locating'
  | 'paused'
export type RecordMode = 'immediate' | 'count_in' | 'pre_roll' | 'punch_in'
export type MetronomeMode = 'off' | 'always'

export interface TransportRange {
  start: number
  end: number
  enabled: boolean
}

function transportStateToPlaybackState(state: TransportState): PlaybackState {
  if (state === 'stopped') return 'stopped'
  if (state === 'paused') return 'paused'
  return 'playing'
}

function readBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {}
  return defaultValue
}

function readNumber(key: string, defaultValue: number): number {
  try {
    const v = localStorage.getItem(key)
    if (v !== null) {
      const n = Number(v)
      if (!Number.isNaN(n) && Number.isFinite(n)) return n
    }
  } catch {}
  return defaultValue
}

interface AudioStore {
  playbackState: PlaybackState
  transportState: TransportState
  recordMode: RecordMode
  currentTime: number
  duration: number
  bpm: number
  masterVolume: number
  metronomeEnabled: boolean
  metronomeMode: MetronomeMode
  key: string
  currentBar: number
  countInBars: number
  preRollBars: number
  autoReturn: boolean
  transportOriginBar: number
  pendingRecordStartBar: number | null
  inputLatencyMs: number
  outputLatencyMs: number
  loop: TransportRange
  punchRange: TransportRange

  metronomeBeat: number

  setPlaybackState: (state: PlaybackState) => void
  setTransportState: (state: TransportState) => void
  setMetronomeBeat: (beat: number) => void
  setRecordMode: (mode: RecordMode) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setBpm: (bpm: number) => void
  setMasterVolume: (vol: number) => void
  toggleMetronome: () => void
  setMetronomeMode: (mode: MetronomeMode) => void
  cycleMetronomeMode: () => void
  setKey: (key: string) => void
  setCurrentBar: (bar: number) => void
  setCountInBars: (bars: number) => void
  setPreRollBars: (bars: number) => void
  setAutoReturn: (autoReturn: boolean) => void
  setTransportOriginBar: (bar: number) => void
  setPendingRecordStartBar: (bar: number | null) => void
  setInputLatencyMs: (latencyMs: number) => void
  setOutputLatencyMs: (latencyMs: number) => void
  setLoop: (loop: TransportRange) => void
  toggleLoop: () => void
  setPunchRange: (range: TransportRange) => void
  togglePunchRange: () => void
}

export const useAudioStore = create<AudioStore>((set) => ({
  playbackState: 'stopped',
  transportState: 'stopped',
  recordMode: 'immediate',
  currentTime: 0,
  duration: 0,
  bpm: readNumber('lava-bpm', 120),
  masterVolume: readNumber('lava-master-volume', 0.8),
  metronomeEnabled: readBoolean('lava-metronome-enabled', false),
  metronomeMode: readBoolean('lava-metronome-enabled', false) ? 'always' : 'off',
  key: 'C',
  currentBar: 0,
  countInBars: 1,
  preRollBars: 1,
  autoReturn: true,
  transportOriginBar: 0,
  pendingRecordStartBar: null,
  inputLatencyMs: 0,
  outputLatencyMs: 0,
  loop: { start: 0, end: 4, enabled: false },
  punchRange: { start: 4, end: 8, enabled: false },
  metronomeBeat: 0,

  setPlaybackState: (state) =>
    set({
      playbackState: state,
      transportState:
        state === 'playing'
          ? 'rolling'
          : state === 'paused'
            ? 'paused'
            : 'stopped',
    }),

  setTransportState: (state) =>
    set({
      transportState: state,
      playbackState: transportStateToPlaybackState(state),
    }),

  setRecordMode: (mode) => set({ recordMode: mode }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setBpm: (bpm) => {
    try { localStorage.setItem('lava-bpm', String(bpm)) } catch {}
    set({ bpm })
  },
  setMasterVolume: (vol) => {
    try { localStorage.setItem('lava-master-volume', String(vol)) } catch {}
    set({ masterVolume: vol })
  },

  toggleMetronome: () =>
    set((state) => {
      const nextMode = state.metronomeMode === 'off' ? 'always' : 'off'
      const enabled = nextMode !== 'off'
      try { localStorage.setItem('lava-metronome-enabled', String(enabled)) } catch {}
      return {
        metronomeMode: nextMode,
        metronomeEnabled: enabled,
      }
    }),

  setMetronomeMode: (mode) => {
    const enabled = mode !== 'off'
    try { localStorage.setItem('lava-metronome-enabled', String(enabled)) } catch {}
    set({
      metronomeMode: mode,
      metronomeEnabled: enabled,
    })
  },

  cycleMetronomeMode: () =>
    set((state) => {
      const nextMode: MetronomeMode = state.metronomeMode === 'off' ? 'always' : 'off'
      const enabled = nextMode !== 'off'
      try { localStorage.setItem('lava-metronome-enabled', String(enabled)) } catch {}
      return {
        metronomeMode: nextMode,
        metronomeEnabled: enabled,
      }
    }),

  setMetronomeBeat: (beat) => set({ metronomeBeat: beat }),
  setKey: (key) => set({ key }),
  setCurrentBar: (bar) => set({ currentBar: bar }),
  setCountInBars: (bars) => set({ countInBars: Math.max(0, bars) }),
  setPreRollBars: (bars) => set({ preRollBars: Math.max(0, bars) }),
  setAutoReturn: (autoReturn) => set({ autoReturn }),
  setTransportOriginBar: (bar) => set({ transportOriginBar: Math.max(0, bar) }),
  setPendingRecordStartBar: (bar) => set({ pendingRecordStartBar: bar }),
  setInputLatencyMs: (latencyMs) => set({ inputLatencyMs: Math.max(0, latencyMs) }),
  setOutputLatencyMs: (latencyMs) => set({ outputLatencyMs: Math.max(0, latencyMs) }),
  setLoop: (loop) => set({ loop }),
  toggleLoop: () => set((state) => ({ loop: { ...state.loop, enabled: !state.loop.enabled } })),
  setPunchRange: (punchRange) => set({ punchRange }),
  togglePunchRange: () =>
    set((state) => ({
      punchRange: { ...state.punchRange, enabled: !state.punchRange.enabled },
    })),
}))
