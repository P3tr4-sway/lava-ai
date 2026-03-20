import { create } from 'zustand'
import type { JamSession, BackingTrack } from '@lava/shared'

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

interface JamStore {
  session: JamSession | null
  availableTracks: BackingTrack[]
  selectedTrackId: string | null
  isRecording: boolean
  tracks: TrackLane[]

  setSession: (session: JamSession | null) => void
  setAvailableTracks: (tracks: BackingTrack[]) => void
  selectTrack: (trackId: string) => void
  setRecording: (recording: boolean) => void
  addTrack: () => void
  removeTrack: (id: string) => void
  updateTrack: (id: string, changes: Partial<TrackLane>) => void
}

let nextTrackNum = 2

export const useJamStore = create<JamStore>((set) => ({
  session: null,
  availableTracks: [],
  selectedTrackId: null,
  isRecording: false,
  tracks: [
    {
      id: 'track-1',
      name: 'Track 1',
      volume: 63,
      pan: 0,
      muted: false,
      solo: false,
      isRecording: false,
      hasRecording: false,
      color: TRACK_COLORS[0],
    },
  ],

  setSession: (session) => set({ session }),
  setAvailableTracks: (tracks) => set({ availableTracks: tracks }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  setRecording: (recording) => set({ isRecording: recording }),

  addTrack: () =>
    set((state) => {
      const colorIndex = state.tracks.length % TRACK_COLORS.length
      const track: TrackLane = {
        id: `track-${nextTrackNum}`,
        name: `Track ${nextTrackNum}`,
        volume: 80,
        pan: 0,
        muted: false,
        solo: false,
        isRecording: false,
        hasRecording: false,
        color: TRACK_COLORS[colorIndex],
      }
      nextTrackNum++
      return { tracks: [...state.tracks, track] }
    }),

  removeTrack: (id) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
    })),

  updateTrack: (id, changes) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, ...changes } : t,
      ),
    })),
}))
