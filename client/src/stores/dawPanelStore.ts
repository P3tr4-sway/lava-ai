import { create } from 'zustand'
import { Clip } from '../audio/types'

const TRACK_COLORS = [
  { bg: '#6f2e15', accent: '#ff621f' },
  { bg: '#1a3a5c', accent: '#3b82f6' },
  { bg: '#2d4a2d', accent: '#22c55e' },
  { bg: '#4a2d4a', accent: '#a855f7' },
  { bg: '#4a3a1a', accent: '#f59e0b' },
  { bg: '#3a1a1a', accent: '#ef4444' },
]

export interface TrackLane {
  id: string
  name: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  hasRecording: boolean
  color: { bg: string; accent: string }
  clips: Clip[]
  recArm: boolean
  inputMonitor: boolean
  recordReady: boolean
  recording: boolean
  recordBlockedReason: string | null
}

export function makeTrack(name: string, index: number): TrackLane {
  return {
    id: `track-${Date.now()}-${index}`,
    name,
    volume: 80,
    pan: 0,
    muted: false,
    solo: false,
    hasRecording: false,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    clips: [],
    recArm: false,
    inputMonitor: true,
    recordReady: false,
    recording: false,
    recordBlockedReason: null,
  }
}

// Generic DAW panel store factory — each page can create its own instance,
// or share via context. For simplicity we export a single shared store here
// that pages can seed with their own initial tracks.

function clipsOverlap(a: Clip, b: Clip): boolean {
  return a.startBar < b.startBar + b.lengthInBars &&
         a.startBar + a.lengthInBars > b.startBar
}

interface DawPanelStore {
  tracks: TrackLane[]
  selectedClipId: string | null
  snapEnabled: boolean

  setTracks: (tracks: TrackLane[]) => void
  addTrack: (name?: string) => void
  updateTrack: (id: string, changes: Partial<TrackLane>) => void
  removeTrack: (id: string) => void
  _syncTrack: (id: string, changes: Partial<TrackLane>) => void

  addClip: (trackId: string, clip: Clip) => void
  updateClip: (trackId: string, clipId: string, changes: Partial<Clip>) => void
  removeClip: (trackId: string, clipId: string) => void
  armTrack: (id: string, armed: boolean) => void
  selectClip: (clipId: string | null) => void
  toggleSnap: () => void
  splitClip: (trackId: string, clipId: string, atBar: number) => void
}

export const useDawPanelStore = create<DawPanelStore>((set, get) => ({
  tracks: [],
  selectedClipId: null,
  snapEnabled: true,

  setTracks: (tracks) => set({ tracks }),

  addTrack: (name) =>
    set((state) => {
      const index = state.tracks.length
      return {
        tracks: [...state.tracks, makeTrack(name ?? `Track ${index + 1}`, index)],
      }
    }),

  updateTrack: (id, changes) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    })),

  removeTrack: (id) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
    })),

  // Convenience: sync from external track list without resetting if same length
  _syncTrack: (id: string, changes: Partial<TrackLane>) => {
    const { tracks } = get()
    const exists = tracks.some((t) => t.id === id)
    if (exists) {
      set((state) => ({
        tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...changes } : t)),
      }))
    }
  },

  addClip: (trackId, clip) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t
        const overlaps = t.clips.some((existing) => clipsOverlap(existing, clip))
        if (overlaps) return t
        return { ...t, clips: [...t.clips, clip] }
      }),
    })),

  updateClip: (trackId, clipId, changes) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? Object.assign({}, c, changes) : c
          ),
        }
      }),
    })),

  removeClip: (trackId, clipId) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t
        return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
      }),
    })),

  armTrack: (id, armed) =>
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        recArm: t.id === id ? armed : armed ? false : t.recArm,
        recordReady: t.id === id ? false : armed ? false : t.recordReady,
        recording: t.id === id ? false : armed ? false : t.recording,
        recordBlockedReason: null,
      })),
    })),

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  splitClip: (trackId, clipId, atBar) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t
        const clip = t.clips.find((c) => c.id === clipId)
        if (!clip) return t
        const clipEnd = clip.startBar + clip.lengthInBars
        if (atBar <= clip.startBar || atBar >= clipEnd) return t

        const clip1: Clip = {
          ...clip,
          id: `${clip.id}-a`,
          lengthInBars: atBar - clip.startBar,
          trimEnd: 0,
        }
        const clip2: Clip = {
          ...clip,
          id: `${clip.id}-b`,
          startBar: atBar,
          lengthInBars: clipEnd - atBar,
          trimStart: 0,
        }

        return {
          ...t,
          clips: t.clips.flatMap((c) => (c.id === clipId ? [clip1, clip2] : [c])),
        }
      }),
    })),
}))
