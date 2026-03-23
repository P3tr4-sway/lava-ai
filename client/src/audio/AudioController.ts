import { ToneEngine } from './ToneEngine'
import { ToneMetronome } from './ToneMetronome'
import { useAudioStore, type TransportState } from '../stores/audioStore'
import { useDawPanelStore } from '../stores/dawPanelStore'
import type { Clip } from './types'
import type { TrackLane } from '../stores/dawPanelStore'

function isRunningState(state: TransportState): boolean {
  return (
    state === 'rolling' ||
    state === 'count_in' ||
    state === 'pre_roll' ||
    state === 'recording' ||
    state === 'auto_punch_wait_in' ||
    state === 'auto_punch_recording' ||
    state === 'loop_wrap'
  )
}

function shouldClick(state: TransportState, metronomeMode: 'off' | 'always'): boolean {
  return metronomeMode === 'always' && isRunningState(state)
}

function isCaptureState(state: TransportState): boolean {
  return state === 'recording' || state === 'auto_punch_recording'
}

export class AudioController {
  private static instance: AudioController | null = null

  private engine: ToneEngine
  private metronome: ToneMetronome
  private intervalId: ReturnType<typeof setInterval> | null = null
  private unsubscribers: Array<() => void> = []

  private destroyed = false
  private prevTrackIds: Set<string> = new Set()
  private prevTrackProps: Map<string, { volume: number; pan: number; muted: boolean; solo: boolean }> = new Map()

  private constructor() {
    this.engine = ToneEngine.getInstance()
    this.metronome = new ToneMetronome()
    this.metronome.onBeat = () => {
      const { metronomeBeat, setMetronomeBeat } = useAudioStore.getState()
      setMetronomeBeat(metronomeBeat + 1)
    }
  }

  static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController()
    }
    return AudioController.instance
  }

  init(): void {
    // Reset destroyed flag — needed when React StrictMode calls destroy() then init() again
    this.destroyed = false
    // Only subscribe if subscriptions were cleared (i.e. after destroy() or first init)
    if (this.unsubscribers.length === 0) {
      this.subscribeToStores()
    }
    // Clear any stale interval before starting a fresh loop
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.startTickLoop()
  }

  private subscribeToStores(): void {
    let prevTransportState = useAudioStore.getState().transportState
    let prevMasterVolume = useAudioStore.getState().masterVolume
    let prevBpm = useAudioStore.getState().bpm
    let prevMetronomeMode = useAudioStore.getState().metronomeMode
    let prevLoop = useAudioStore.getState().loop

    const unsubAudio = useAudioStore.subscribe((state) => {
      if (state.transportState !== prevTransportState) {
        this.handleTransportStateChange(prevTransportState, state.transportState)
        prevTransportState = state.transportState
      }

      if (state.masterVolume !== prevMasterVolume) {
        prevMasterVolume = state.masterVolume
        this.engine.setMasterVolume(state.masterVolume)
      }

      if (state.bpm !== prevBpm) {
        prevBpm = state.bpm
        this.engine.setBpm(state.bpm)
        this.metronome.setBpm(state.bpm)
      }

      if (
        state.metronomeMode !== prevMetronomeMode ||
        state.loop !== prevLoop
      ) {
        prevMetronomeMode = state.metronomeMode
        prevLoop = state.loop
        this.engine.setLoopRange(state.loop)
        this.syncMetronome(state.transportState)
      }
    })
    this.unsubscribers.push(unsubAudio)

    const unsubTracks = useDawPanelStore.subscribe((state) => {
      this.reconcileTracks(state.tracks)
    })
    this.unsubscribers.push(unsubTracks)

    const { masterVolume, bpm, loop } = useAudioStore.getState()
    this.engine.setMasterVolume(masterVolume)
    this.engine.setBpm(bpm)
    this.engine.setLoopRange(loop)
    this.metronome.setBpm(bpm)

    const { tracks } = useDawPanelStore.getState()
    if (tracks.length > 0) {
      this.reconcileTracks(tracks)
    }
  }

  private handleTransportStateChange(prevState: TransportState, nextState: TransportState): void {
    const audio = useAudioStore.getState()
    const clips = this.getAllClips()
    const shouldRestartEngine =
      !isRunningState(prevState) ||
      nextState === 'count_in' ||
      (prevState === 'count_in' && isCaptureState(nextState)) ||
      (nextState === 'rolling' && prevState === 'count_in') ||
      prevState === 'stopped'

    if (nextState === 'stopped') {
      this.engine.stop()
      this.metronome.stop()
      return
    }

    if (nextState === 'paused') {
      this.engine.pause()
      this.metronome.stop()
      return
    }

    if (!isRunningState(nextState)) {
      this.syncMetronome(nextState)
      return
    }

    if (shouldRestartEngine) {
      const shouldPlayClips = nextState !== 'count_in'
      this.engine.play(
        audio.currentBar,
        shouldPlayClips ? clips : [],
        audio.loop,
      ).then(() => {
        // Schedule metronome AFTER engine.play() finishes — engine.play()
        // calls transport.cancel() which wipes all scheduled events.
        this.syncMetronome(nextState)
      }).catch((err) => console.error('[AudioController] engine.play() failed:', err))
      return
    }

    this.syncMetronome(nextState)
  }

  private syncMetronome(state: TransportState): void {
    const { metronomeMode, currentBar } = useAudioStore.getState()
    const active = shouldClick(state, metronomeMode)
    this.metronome.setEnabled(active)
    if (active) {
      this.metronome.start(currentBar)
    } else {
      this.metronome.stop()
    }
  }

  private reconcileTracks(tracks: TrackLane[]): void {
    const currentIds = new Set(tracks.map((t) => t.id))

    for (const id of this.prevTrackIds) {
      if (!currentIds.has(id)) {
        this.engine.destroyTrack(id)
        this.prevTrackProps.delete(id)
      }
    }

    for (const track of tracks) {
      const prev = this.prevTrackProps.get(track.id)

      if (!prev) {
        this.engine.createTrack(track.id)
        this.engine.setTrackVolume(track.id, track.volume / 100)
        this.engine.setTrackPan(track.id, track.pan / 100)
        if (track.muted) this.engine.muteTrack(track.id, true)
        if (track.solo) this.engine.soloTrack(track.id, true)
      } else {
        if (prev.volume !== track.volume && !track.muted) {
          this.engine.setTrackVolume(track.id, track.volume / 100)
        }
        if (prev.pan !== track.pan) {
          this.engine.setTrackPan(track.id, track.pan / 100)
        }
        if (prev.muted !== track.muted) {
          this.engine.muteTrack(track.id, track.muted)
        }
        if (prev.solo !== track.solo) {
          this.engine.soloTrack(track.id, track.solo)
        }
      }

      this.prevTrackProps.set(track.id, {
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
      })
    }

    this.prevTrackIds = currentIds
  }

  private getAllClips(): Clip[] {
    const { tracks } = useDawPanelStore.getState()
    return tracks.flatMap((t) => t.clips).filter((clip) => clip.status !== 'temp')
  }

  private startTickLoop(): void {
    // Use setInterval instead of requestAnimationFrame so the loop keeps running
    // in background tabs and hidden preview frames (rAF is throttled/paused there).
    this.intervalId = setInterval(() => {
      if (this.destroyed) {
        if (this.intervalId !== null) clearInterval(this.intervalId)
        return
      }
      const audio = useAudioStore.getState()

      if (isRunningState(audio.transportState)) {
        const currentBar = this.engine.getCurrentBar()
        const currentTime = this.engine.getCurrentTimeSec()

        audio.setCurrentBar(currentBar)
        audio.setCurrentTime(currentTime)

        if (
          audio.transportState === 'count_in' &&
          audio.pendingRecordStartBar !== null &&
          currentBar >= audio.pendingRecordStartBar
        ) {
          audio.setTransportState('recording')
        }

        if (
          audio.transportState === 'pre_roll' &&
          audio.pendingRecordStartBar !== null &&
          currentBar >= audio.pendingRecordStartBar
        ) {
          audio.setTransportState('recording')
        }

        if (
          audio.transportState === 'auto_punch_wait_in' &&
          audio.pendingRecordStartBar !== null &&
          currentBar >= audio.pendingRecordStartBar
        ) {
          audio.setTransportState('auto_punch_recording')
        }

        if (
          (audio.transportState === 'recording' || audio.transportState === 'auto_punch_recording') &&
          audio.punchRange.enabled &&
          currentBar >= audio.punchRange.end
        ) {
          audio.setPendingRecordStartBar(null)
          audio.setTransportState('rolling')
        }
      }
    }, 16) // ~60 fps
  }

  destroy(): void {
    this.destroyed = true

    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []

    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
