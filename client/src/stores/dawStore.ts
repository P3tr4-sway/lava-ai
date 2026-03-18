import { create } from 'zustand'
import type { Track } from '@lava/shared'

interface DAWStore {
  tracks: Track[]
  playheadPosition: number
  zoom: number
  selectedTrackId: string | null
  loopStart: number | null
  loopEnd: number | null

  setTracks: (tracks: Track[]) => void
  addTrack: (track: Track) => void
  updateTrack: (id: string, updates: Partial<Track>) => void
  removeTrack: (id: string) => void
  setPlayhead: (pos: number) => void
  setZoom: (zoom: number) => void
  selectTrack: (id: string | null) => void
  setLoop: (start: number | null, end: number | null) => void
}

export const useDAWStore = create<DAWStore>((set) => ({
  tracks: [],
  playheadPosition: 0,
  zoom: 1,
  selectedTrackId: null,
  loopStart: null,
  loopEnd: null,

  setTracks: (tracks) => set({ tracks }),
  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),

  updateTrack: (id, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTrack: (id) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
      selectedTrackId: state.selectedTrackId === id ? null : state.selectedTrackId,
    })),

  setPlayhead: (pos) => set({ playheadPosition: pos }),
  setZoom: (zoom) => set({ zoom }),
  selectTrack: (id) => set({ selectedTrackId: id }),
  setLoop: (start, end) => set({ loopStart: start, loopEnd: end }),
}))
