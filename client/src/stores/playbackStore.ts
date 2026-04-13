/**
 * playbackStore — Zustand store for alphaTex playback state.
 *
 * Decoupled from the existing audioStore (which drives the MusicXML editor).
 * Updated by the usePlayer hook via the Player event callbacks.
 */

import { create } from 'zustand'
import type { PlaybackState, PlayerPosition, LoopRange } from '../playback/player'

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface PlaybackStoreState {
  state: PlaybackState
  position: PlayerPosition | null
  /** Playback speed multiplier, 0.25–2.0, default 1.0 */
  speed: number
  loop: LoopRange | null
  metronome: boolean
  countIn: boolean
  /** trackIndex → volume (0..1) */
  trackVolumes: Record<number, number>
  /** trackIndex → muted */
  trackMuted: Record<number, boolean>
  /** trackIndex → soloed */
  trackSoloed: Record<number, boolean>

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  setState: (s: PlaybackState) => void
  setPosition: (p: PlayerPosition) => void
  setSpeed: (r: number) => void
  setLoop: (l: LoopRange | null) => void
  setMetronome: (on: boolean) => void
  setCountIn: (on: boolean) => void
  setTrackVolume: (idx: number, vol: number) => void
  setTrackMuted: (idx: number, muted: boolean) => void
  setTrackSoloed: (idx: number, solo: boolean) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePlaybackStore = create<PlaybackStoreState>((set) => ({
  state: 'stopped',
  position: null,
  speed: 1.0,
  loop: null,
  metronome: false,
  countIn: false,
  trackVolumes: {},
  trackMuted: {},
  trackSoloed: {},

  setState: (s) => set({ state: s }),
  setPosition: (p) => set({ position: p }),
  setSpeed: (r) => set({ speed: Math.max(0.25, Math.min(2.0, r)) }),
  setLoop: (l) => set({ loop: l }),
  setMetronome: (on) => set({ metronome: on }),
  setCountIn: (on) => set({ countIn: on }),

  setTrackVolume: (idx, vol) =>
    set((prev) => ({
      trackVolumes: { ...prev.trackVolumes, [idx]: Math.max(0, Math.min(1, vol)) },
    })),

  setTrackMuted: (idx, muted) =>
    set((prev) => ({
      trackMuted: { ...prev.trackMuted, [idx]: muted },
    })),

  setTrackSoloed: (idx, solo) =>
    set((prev) => ({
      trackSoloed: { ...prev.trackSoloed, [idx]: solo },
    })),
}))
