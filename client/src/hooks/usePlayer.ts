/**
 * usePlayer — React hook that manages the Player lifecycle.
 *
 * Creates a Player instance using the AlphaTabBridge ref supplied by
 * useAlphaTabBridge, wires the player's event callbacks into the playback
 * store, and returns imperative controls for use in UI components.
 */

import { useEffect, useRef, useCallback } from 'react'
import type React from 'react'
import { Player } from '../playback/player'
import type { LoopRange } from '../playback/player'
import { usePlaybackStore } from '../stores/playbackStore'
import type { AlphaTabBridge } from '../render/alphaTabBridge'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlayer(bridgeRef: React.RefObject<AlphaTabBridge | null>) {
  const playerRef = useRef<Player | null>(null)

  // ---------------------------------------------------------------------------
  // Create Player when bridge becomes available
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const bridge = bridgeRef.current
    if (!bridge) return

    const player = new Player(bridge)

    // Wire callbacks → store
    player.onStateChange = (state) => {
      usePlaybackStore.getState().setState(state)
    }
    player.onPositionChange = (pos) => {
      usePlaybackStore.getState().setPosition(pos)
    }

    playerRef.current = player

    return () => {
      player.destroy()
      playerRef.current = null
      // Reset store to a clean stopped state on teardown
      usePlaybackStore.getState().setState('stopped')
    }
    // bridgeRef is a stable React ref object — only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Imperative controls — always read from ref so they're never stale
  // ---------------------------------------------------------------------------

  const play = useCallback(() => {
    playerRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pause()
  }, [])

  const stop = useCallback(() => {
    playerRef.current?.stop()
  }, [])

  const seek = useCallback((tick: number) => {
    playerRef.current?.seek(tick)
  }, [])

  const setSpeed = useCallback((rate: number) => {
    playerRef.current?.setSpeed(rate)
    usePlaybackStore.getState().setSpeed(rate)
  }, [])

  const setLoop = useCallback((range: LoopRange | null) => {
    playerRef.current?.setLoop(range)
    usePlaybackStore.getState().setLoop(range)
  }, [])

  const setMetronome = useCallback((on: boolean) => {
    playerRef.current?.setMetronome(on)
    usePlaybackStore.getState().setMetronome(on)
  }, [])

  const setCountIn = useCallback((on: boolean) => {
    playerRef.current?.setCountIn(on)
    usePlaybackStore.getState().setCountIn(on)
  }, [])

  return {
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setLoop,
    setMetronome,
    setCountIn,
    /** Direct access to the Player instance for advanced use cases. */
    playerRef,
  }
}
