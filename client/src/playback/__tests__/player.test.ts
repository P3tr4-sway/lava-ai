/**
 * Player unit tests.
 *
 * AlphaTabBridge.getApi() is mocked to return a mock AlphaTabApi so these
 * tests are pure TypeScript with no real alphaTab dependency at runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Player } from '../player'
import type { AlphaTabBridge } from '../../render/alphaTabBridge'
import { synth } from '@coderline/alphatab'

// ---------------------------------------------------------------------------
// Mock API factory
// ---------------------------------------------------------------------------

type StateChangedHandler = (args: synth.PlayerStateChangedEventArgs) => void
type PositionChangedHandler = (args: synth.PositionChangedEventArgs) => void

function makeMockApi() {
  const stateHandlers: StateChangedHandler[] = []
  const positionHandlers: PositionChangedHandler[] = []

  const mockApi = {
    playerStateChanged: {
      on: vi.fn((handler: StateChangedHandler) => {
        stateHandlers.push(handler)
        // Return an unsubscribe function (matching alphaTab EventEmitter API)
        return () => {
          const idx = stateHandlers.indexOf(handler)
          if (idx !== -1) stateHandlers.splice(idx, 1)
        }
      }),
    },
    playerPositionChanged: {
      on: vi.fn((handler: PositionChangedHandler) => {
        positionHandlers.push(handler)
        return () => {
          const idx = positionHandlers.indexOf(handler)
          if (idx !== -1) positionHandlers.splice(idx, 1)
        }
      }),
    },
    playbackSpeed: 1,
    play: vi.fn().mockReturnValue(true),
    pause: vi.fn(),
    stop: vi.fn(),
    tickPosition: 0,
    isReadyForPlayback: true,
    isLooping: false,
    playbackRange: null as { startTick: number; endTick: number } | null,
    metronomeVolume: 0,
    countInVolume: 0,
    score: {
      tracks: [
        { index: 0 },
        { index: 1 },
      ],
      masterBars: [] as Array<{ start: number }>,
    },
    changeTrackVolume: vi.fn(),
    changeTrackMute: vi.fn(),
    changeTrackSolo: vi.fn(),

    // Helpers to fire events in tests
    _fireStateChanged: (args: synth.PlayerStateChangedEventArgs) => {
      stateHandlers.forEach((h) => h(args))
    },
    _firePositionChanged: (args: synth.PositionChangedEventArgs) => {
      positionHandlers.forEach((h) => h(args))
    },
  }

  return mockApi
}

type MockApi = ReturnType<typeof makeMockApi>

function makeBridge(api: MockApi | null): AlphaTabBridge {
  return {
    getApi: vi.fn(() => api),
  } as unknown as AlphaTabBridge
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Player — playback control', () => {
  let mockApi: MockApi
  let player: Player

  beforeEach(() => {
    mockApi = makeMockApi()
    const bridge = makeBridge(mockApi)
    player = new Player(bridge)
  })

  it('play() calls api.play()', () => {
    player.play()
    expect(mockApi.play).toHaveBeenCalledTimes(1)
  })

  it('pause() calls api.pause()', () => {
    player.pause()
    expect(mockApi.pause).toHaveBeenCalledTimes(1)
  })

  it('stop() calls api.stop()', () => {
    player.stop()
    expect(mockApi.stop).toHaveBeenCalledTimes(1)
  })

  it('setSpeed(1.5) sets api.playbackSpeed = 1.5', () => {
    player.setSpeed(1.5)
    expect(mockApi.playbackSpeed).toBe(1.5)
  })

  it('setSpeed clamps to [0.25, 2.0]', () => {
    player.setSpeed(0.1)
    expect(mockApi.playbackSpeed).toBe(0.25)
    player.setSpeed(99)
    expect(mockApi.playbackSpeed).toBe(2.0)
  })

  it('seek(1000) sets api.tickPosition = 1000', () => {
    player.seek(1000)
    expect(mockApi.tickPosition).toBe(1000)
  })
})

describe('Player — event callbacks', () => {
  let mockApi: MockApi
  let player: Player

  beforeEach(() => {
    mockApi = makeMockApi()
    const bridge = makeBridge(mockApi)
    player = new Player(bridge)
  })

  it('onStateChange fires with "playing" when playerStateChanged fires Playing', () => {
    const cb = vi.fn()
    player.onStateChange = cb

    mockApi._fireStateChanged({
      state: synth.PlayerState.Playing,
      stopped: false,
    } as synth.PlayerStateChangedEventArgs)

    expect(cb).toHaveBeenCalledWith('playing')
  })

  it('onStateChange fires with "paused" when state is Paused and not stopped', () => {
    const cb = vi.fn()
    player.onStateChange = cb

    mockApi._fireStateChanged({
      state: synth.PlayerState.Paused,
      stopped: false,
    } as synth.PlayerStateChangedEventArgs)

    expect(cb).toHaveBeenCalledWith('paused')
  })

  it('onStateChange fires with "stopped" when stopped=true', () => {
    const cb = vi.fn()
    player.onStateChange = cb

    mockApi._fireStateChanged({
      state: synth.PlayerState.Paused,
      stopped: true,
    } as synth.PlayerStateChangedEventArgs)

    expect(cb).toHaveBeenCalledWith('stopped')
  })

  it('onPositionChange fires when playerPositionChanged event fires', () => {
    const cb = vi.fn()
    player.onPositionChange = cb

    mockApi._firePositionChanged({
      currentTime: 5000,
      currentTick: 2048,
      endTick: 16384,
      endTime: 60000,
      isSeek: false,
      originalTempo: 120,
      modifiedTempo: 120,
    } as synth.PositionChangedEventArgs)

    expect(cb).toHaveBeenCalledTimes(1)
    const pos = cb.mock.calls[0][0]
    expect(pos.currentTick).toBe(2048)
    expect(pos.currentTimeMs).toBe(5000)
  })
})

describe('Player — null/not-ready guard', () => {
  it('play() before bridge is ready is a no-op (no throw)', () => {
    const bridge = makeBridge(null)
    const player = new Player(bridge)
    expect(() => player.play()).not.toThrow()
  })

  it('pause() before bridge is ready is a no-op', () => {
    const bridge = makeBridge(null)
    const player = new Player(bridge)
    expect(() => player.pause()).not.toThrow()
  })

  it('stop() before bridge is ready is a no-op', () => {
    const bridge = makeBridge(null)
    const player = new Player(bridge)
    expect(() => player.stop()).not.toThrow()
  })

  it('play() does not call api.play() when isReadyForPlayback is false', () => {
    const mockApi = makeMockApi()
    mockApi.isReadyForPlayback = false
    const bridge = makeBridge(mockApi)
    const player = new Player(bridge)
    player.play()
    expect(mockApi.play).not.toHaveBeenCalled()
  })
})

describe('Player — per-track controls', () => {
  let mockApi: MockApi
  let player: Player

  beforeEach(() => {
    mockApi = makeMockApi()
    const bridge = makeBridge(mockApi)
    player = new Player(bridge)
  })

  it('setTrackVolume calls api.changeTrackVolume with the correct track and volume', () => {
    player.setTrackVolume(0, 0.7)
    expect(mockApi.changeTrackVolume).toHaveBeenCalledTimes(1)
    expect(mockApi.changeTrackVolume).toHaveBeenCalledWith(
      [mockApi.score.tracks[0]],
      0.7,
    )
  })

  it('setTrackVolume clamps volume to [0, 1]', () => {
    player.setTrackVolume(0, 1.5)
    expect(mockApi.changeTrackVolume).toHaveBeenCalledWith(
      [mockApi.score.tracks[0]],
      1,
    )
  })

  it('setTrackMute calls api.changeTrackMute with the correct track and muted flag', () => {
    player.setTrackMute(1, true)
    expect(mockApi.changeTrackMute).toHaveBeenCalledWith(
      [mockApi.score.tracks[1]],
      true,
    )
  })

  it('setTrackSolo calls api.changeTrackSolo with the correct track and solo flag', () => {
    player.setTrackSolo(0, true)
    expect(mockApi.changeTrackSolo).toHaveBeenCalledWith(
      [mockApi.score.tracks[0]],
      true,
    )
  })

  it('setTrackVolume is a no-op for out-of-range track index', () => {
    player.setTrackVolume(99, 0.5)
    expect(mockApi.changeTrackVolume).not.toHaveBeenCalled()
  })
})

describe('Player — loop', () => {
  let mockApi: MockApi
  let player: Player

  beforeEach(() => {
    mockApi = makeMockApi()
    const bridge = makeBridge(mockApi)
    player = new Player(bridge)
  })

  it('setLoop with a range sets playbackRange and enables isLooping', () => {
    player.setLoop({ startTick: 100, endTick: 500 })
    expect(mockApi.isLooping).toBe(true)
    expect(mockApi.playbackRange).toEqual({ startTick: 100, endTick: 500 })
  })

  it('setLoop(null) disables looping and clears playbackRange', () => {
    player.setLoop({ startTick: 100, endTick: 500 })
    player.setLoop(null)
    expect(mockApi.isLooping).toBe(false)
    expect(mockApi.playbackRange).toBeNull()
  })
})

describe('Player — state accessors', () => {
  let mockApi: MockApi
  let player: Player

  beforeEach(() => {
    mockApi = makeMockApi()
    const bridge = makeBridge(mockApi)
    player = new Player(bridge)
  })

  it('getState() returns "stopped" initially', () => {
    expect(player.getState()).toBe('stopped')
  })

  it('getState() updates after a stateChanged event', () => {
    mockApi._fireStateChanged({
      state: synth.PlayerState.Playing,
      stopped: false,
    } as synth.PlayerStateChangedEventArgs)

    expect(player.getState()).toBe('playing')
  })

  it('getPosition() returns initial zero position', () => {
    const pos = player.getPosition()
    expect(pos.currentTick).toBe(0)
    expect(pos.currentTimeMs).toBe(0)
    expect(pos.beatPosition).toBeNull()
  })
})

describe('Player — destroy', () => {
  it('destroy() prevents further state callbacks after teardown', () => {
    const mockApi = makeMockApi()
    const bridge = makeBridge(mockApi)
    const player = new Player(bridge)
    const cb = vi.fn()
    player.onStateChange = cb

    player.destroy()

    mockApi._fireStateChanged({
      state: synth.PlayerState.Playing,
      stopped: false,
    } as synth.PlayerStateChangedEventArgs)

    // Callback is nulled out on destroy
    expect(cb).not.toHaveBeenCalled()
  })
})
