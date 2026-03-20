import { create } from 'zustand'

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
  isRecording: boolean
  hasRecording: boolean
  color: { bg: string; accent: string }
}

export function makeTrack(name: string, index: number): TrackLane {
  return {
    id: `track-${Date.now()}-${index}`,
    name,
    volume: 80,
    pan: 0,
    muted: false,
    solo: false,
    isRecording: false,
    hasRecording: false,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
  }
}

// Generic DAW panel store factory — each page can create its own instance,
// or share via context. For simplicity we export a single shared store here
// that pages can seed with their own initial tracks.

interface DawPanelStore {
  tracks: TrackLane[]
  setTracks: (tracks: TrackLane[]) => void
  addTrack: (name?: string) => void
  updateTrack: (id: string, changes: Partial<TrackLane>) => void
  removeTrack: (id: string) => void
}

export const useDawPanelStore = create<DawPanelStore>((set, get) => ({
  tracks: [],

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
}))
