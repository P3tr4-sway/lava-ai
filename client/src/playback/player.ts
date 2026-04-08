/**
 * Player — thin wrapper over alphaTab's AlphaSynth player.
 *
 * Pure TypeScript, no React. Handles play/pause/stop, speed, loop,
 * metronome, count-in, and per-track volume/mute/solo.
 *
 * The bridge must already be initialised (bridge.init() called) before
 * Player methods that interact with the API are invoked. All calls are
 * guarded with null checks so callers are safe to call before readiness.
 */

import {
  type AlphaTabApi,
  synth,
} from '@coderline/alphatab'
import type { AlphaTabBridge, HitPosition } from '../render/alphaTabBridge'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PlaybackState = 'stopped' | 'playing' | 'paused'

export interface PlayerPosition {
  currentTick: number
  currentTimeMs: number
  /** Beat position derived from tick — used to drive the playback cursor */
  beatPosition: HitPosition | null
}

export interface LoopRange {
  startTick: number
  endTick: number
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export class Player {
  private readonly bridge: AlphaTabBridge
  private _state: PlaybackState = 'stopped'
  private _position: PlayerPosition = { currentTick: 0, currentTimeMs: 0, beatPosition: null }

  // Cleanup handles for subscribed events
  private offStateChanged: (() => void) | null = null
  private offPositionChanged: (() => void) | null = null

  // Public event callbacks
  onStateChange: ((state: PlaybackState) => void) | null = null
  onPositionChange: ((pos: PlayerPosition) => void) | null = null

  constructor(bridge: AlphaTabBridge) {
    this.bridge = bridge
    this._subscribeToApi()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private get api(): AlphaTabApi | null {
    return this.bridge.getApi()
  }

  private _subscribeToApi(): void {
    const api = this.api
    if (!api) return

    // playerStateChanged → PlaybackState
    this.offStateChanged = api.playerStateChanged.on(
      (args: synth.PlayerStateChangedEventArgs) => {
        let next: PlaybackState
        if (args.stopped) {
          next = 'stopped'
        } else if (args.state === synth.PlayerState.Playing) {
          next = 'playing'
        } else {
          next = 'paused'
        }
        this._state = next
        this.onStateChange?.(next)
      },
    )

    // playerPositionChanged → PlayerPosition
    this.offPositionChanged = api.playerPositionChanged.on(
      (args: synth.PositionChangedEventArgs) => {
        const beatPosition = this._deriveBeatPosition(args.currentTick)
        const pos: PlayerPosition = {
          currentTick: args.currentTick,
          currentTimeMs: args.currentTime,
          beatPosition,
        }
        this._position = pos
        this.onPositionChange?.(pos)
      },
    )
  }

  /**
   * Attempt to derive a HitPosition from the current tick using the
   * boundsLookup. Returns null if the lookup is not yet available.
   */
  private _deriveBeatPosition(currentTick: number): HitPosition | null {
    const api = this.api
    if (!api) return null

    const score = api.score
    if (!score?.masterBars?.length) return null

    // Find which masterBar the tick falls in
    let barIndex = 0
    const masterBars = score.masterBars as Array<{ start: number }>
    for (let i = 0; i < masterBars.length; i++) {
      if ((masterBars[i]?.start ?? 0) <= currentTick) {
        barIndex = i
      } else {
        break
      }
    }

    // Return a minimal HitPosition pointing to the first beat of the bar;
    // the exact beat resolution would require a full bounds lookup traversal
    // which is expensive in the position-changed hot path.
    return {
      trackIndex: 0,
      barIndex,
      voiceIndex: 0,
      beatIndex: 0,
      stringIndex: 1,
    }
  }

  // ---------------------------------------------------------------------------
  // Playback control
  // ---------------------------------------------------------------------------

  play(): void {
    const api = this.api
    if (!api?.isReadyForPlayback) return
    api.play()
  }

  pause(): void {
    const api = this.api
    if (!api) return
    api.pause()
  }

  stop(): void {
    const api = this.api
    if (!api) return
    api.stop()
  }

  seek(tick: number): void {
    const api = this.api
    if (!api) return
    try {
      api.tickPosition = tick
    } catch {
      // player may not be ready for seeks yet
    }
  }

  /** Set playback speed (0.25 to 2.0). */
  setSpeed(rate: number): void {
    const api = this.api
    if (!api) return
    api.playbackSpeed = Math.max(0.25, Math.min(2.0, rate))
  }

  /** Set a loop range. Pass null to disable looping. */
  setLoop(range: LoopRange | null): void {
    const api = this.api
    if (!api) return
    if (range === null) {
      api.isLooping = false
      api.playbackRange = null
    } else {
      api.playbackRange = { startTick: range.startTick, endTick: range.endTick }
      api.isLooping = true
    }
  }

  /**
   * Enable or disable the metronome by setting its volume.
   * alphaTab uses volume 0 = off, >0 = on (default 1.0 when on).
   */
  setMetronome(on: boolean): void {
    const api = this.api
    if (!api) return
    api.metronomeVolume = on ? 1.0 : 0
  }

  /**
   * Enable or disable count-in by setting its volume.
   */
  setCountIn(on: boolean): void {
    const api = this.api
    if (!api) return
    api.countInVolume = on ? 1.0 : 0
  }

  // ---------------------------------------------------------------------------
  // Per-track volume / mute / solo
  // ---------------------------------------------------------------------------

  setTrackVolume(trackIndex: number, volume: number): void {
    const api = this.api
    if (!api) return
    const track = api.score?.tracks?.[trackIndex]
    if (!track) return
    api.changeTrackVolume([track], Math.max(0, Math.min(1, volume)))
  }

  setTrackMute(trackIndex: number, muted: boolean): void {
    const api = this.api
    if (!api) return
    const track = api.score?.tracks?.[trackIndex]
    if (!track) return
    api.changeTrackMute([track], muted)
  }

  setTrackSolo(trackIndex: number, solo: boolean): void {
    const api = this.api
    if (!api) return
    const track = api.score?.tracks?.[trackIndex]
    if (!track) return
    api.changeTrackSolo([track], solo)
  }

  // ---------------------------------------------------------------------------
  // State accessors
  // ---------------------------------------------------------------------------

  getState(): PlaybackState {
    return this._state
  }

  getPosition(): PlayerPosition {
    return this._position
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    if (this.offStateChanged) {
      this.offStateChanged()
      this.offStateChanged = null
    }
    if (this.offPositionChanged) {
      this.offPositionChanged()
      this.offPositionChanged = null
    }
    this.onStateChange = null
    this.onPositionChange = null
  }
}
