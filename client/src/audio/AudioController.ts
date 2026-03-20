import { AudioEngine } from './AudioEngine'
import { MetronomeScheduler } from './MetronomeScheduler'
import { useAudioStore } from '../stores/audioStore'
import { useDawPanelStore } from '../stores/dawPanelStore'
import type { Clip } from './types'
import type { TrackLane } from '../stores/dawPanelStore'

export class AudioController {
  private static instance: AudioController | null = null

  private engine: AudioEngine
  private metronome: MetronomeScheduler
  private rafId: number | null = null
  private unsubscribers: Array<() => void> = []

  // Track diff state — used to detect added/removed tracks and property changes
  private prevTrackIds: Set<string> = new Set()
  private prevTrackProps: Map<string, { volume: number; pan: number; muted: boolean; solo: boolean }> = new Map()

  private constructor() {
    this.engine = AudioEngine.getInstance()
    this.metronome = new MetronomeScheduler()
  }

  static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController()
    }
    return AudioController.instance
  }

  init(): void {
    this.subscribeToStores()
    this.startRafLoop()
  }

  // ---------------------------------------------------------------------------
  // Store subscriptions
  // ---------------------------------------------------------------------------

  private subscribeToStores(): void {
    // Zustand v4 subscribe takes a single listener (state) => void.
    // We do our own prev-value tracking to fire only on relevant changes.

    // 1. audioStore — playbackState, masterVolume, bpm, metronomeEnabled
    let prevPlaybackState = useAudioStore.getState().playbackState
    let prevMasterVolume = useAudioStore.getState().masterVolume
    let prevBpm = useAudioStore.getState().bpm
    let prevMetronomeEnabled = useAudioStore.getState().metronomeEnabled

    const unsubAudio = useAudioStore.subscribe((state) => {
      // playbackState
      if (state.playbackState !== prevPlaybackState) {
        prevPlaybackState = state.playbackState
        if (state.playbackState === 'playing') {
          const { currentBar } = useAudioStore.getState()
          const clips = this.getAllClips()
          void this.engine.play(currentBar, clips)
          if (state.metronomeEnabled) {
            this.metronome.start(currentBar)
          }
        } else if (state.playbackState === 'paused') {
          this.engine.pause()
          this.metronome.stop()
        } else {
          // 'stopped'
          this.engine.stop()
          this.metronome.stop()
          useAudioStore.getState().setCurrentBar(0)
        }
      }

      // masterVolume
      if (state.masterVolume !== prevMasterVolume) {
        prevMasterVolume = state.masterVolume
        this.engine.setMasterVolume(state.masterVolume)
      }

      // bpm
      if (state.bpm !== prevBpm) {
        prevBpm = state.bpm
        this.engine.setBpm(state.bpm)
        this.metronome.setBpm(state.bpm)
      }

      // metronomeEnabled
      if (state.metronomeEnabled !== prevMetronomeEnabled) {
        prevMetronomeEnabled = state.metronomeEnabled
        this.metronome.setEnabled(state.metronomeEnabled)
        if (state.playbackState === 'playing') {
          if (state.metronomeEnabled) {
            this.metronome.start(useAudioStore.getState().currentBar)
          } else {
            this.metronome.stop()
          }
        }
      }
    })
    this.unsubscribers.push(unsubAudio)

    // 2. dawPanelStore — tracks
    const unsubTracks = useDawPanelStore.subscribe((state) => {
      this.reconcileTracks(state.tracks)
    })
    this.unsubscribers.push(unsubTracks)

    // Apply initial state from stores on first init
    const { masterVolume, bpm, metronomeEnabled } = useAudioStore.getState()
    this.engine.setMasterVolume(masterVolume)
    this.engine.setBpm(bpm)
    this.metronome.setBpm(bpm)
    this.metronome.setEnabled(metronomeEnabled)

    // Reconcile any tracks already present in the store at init time
    const { tracks } = useDawPanelStore.getState()
    if (tracks.length > 0) {
      this.reconcileTracks(tracks)
    }
  }

  // ---------------------------------------------------------------------------
  // Track reconciliation
  // ---------------------------------------------------------------------------

  private reconcileTracks(tracks: TrackLane[]): void {
    const currentIds = new Set(tracks.map((t) => t.id))

    // Detect removed tracks
    for (const id of this.prevTrackIds) {
      if (!currentIds.has(id)) {
        this.engine.destroyTrackNodes(id)
        this.prevTrackProps.delete(id)
      }
    }

    // Detect added tracks and property changes
    for (const track of tracks) {
      const prev = this.prevTrackProps.get(track.id)

      if (!prev) {
        // New track — create nodes and set initial properties
        this.engine.createTrackNodes(track.id)
        // volume in TrackLane is 0-100, engine expects 0.0-1.0
        this.engine.setTrackVolume(track.id, track.volume / 100)
        this.engine.setTrackPan(track.id, track.pan)
        if (track.muted) {
          this.engine.muteTrack(track.id, true)
        }
        if (track.solo) {
          this.engine.soloTrack(track.id, true)
        }
      } else {
        // Existing track — diff properties and update only what changed
        if (prev.volume !== track.volume) {
          if (!track.muted) {
            this.engine.setTrackVolume(track.id, track.volume / 100)
          }
        }
        if (prev.pan !== track.pan) {
          this.engine.setTrackPan(track.id, track.pan)
        }
        if (prev.muted !== track.muted) {
          this.engine.muteTrack(track.id, track.muted)
        }
        if (prev.solo !== track.solo) {
          this.engine.soloTrack(track.id, track.solo)
        }
      }

      // Update cached props
      this.prevTrackProps.set(track.id, {
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
      })
    }

    this.prevTrackIds = currentIds
  }

  // ---------------------------------------------------------------------------
  // Clip collection
  // ---------------------------------------------------------------------------

  private getAllClips(): Clip[] {
    const { tracks } = useDawPanelStore.getState()
    return tracks.flatMap((t) => t.clips)
  }

  // ---------------------------------------------------------------------------
  // rAF loop — updates currentBar and currentTime in the store
  // ---------------------------------------------------------------------------

  private startRafLoop(): void {
    const tick = () => {
      const { playbackState, loop } = useAudioStore.getState()

      if (playbackState === 'playing') {
        const currentBar = this.engine.getCurrentBar()
        const currentTime = this.engine.getCurrentTimeSec()

        useAudioStore.getState().setCurrentBar(currentBar)
        useAudioStore.getState().setCurrentTime(currentTime)

        // Loop handling
        if (loop.enabled && currentBar >= loop.end) {
          useAudioStore.getState().setCurrentBar(loop.start)
          void this.engine.play(loop.start, this.getAllClips())
          if (useAudioStore.getState().metronomeEnabled) {
            this.metronome.start(loop.start)
          }
        }
      }

      this.rafId = requestAnimationFrame(tick)
    }

    this.rafId = requestAnimationFrame(tick)
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}
