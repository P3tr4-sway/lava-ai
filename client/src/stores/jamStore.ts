import { create } from 'zustand'
import type { JamSession, BackingTrack } from '@lava/shared'

interface JamStore {
  session: JamSession | null
  availableTracks: BackingTrack[]
  selectedTrackId: string | null
  isRecording: boolean

  setSession: (session: JamSession | null) => void
  setAvailableTracks: (tracks: BackingTrack[]) => void
  selectTrack: (trackId: string) => void
  setRecording: (recording: boolean) => void
}

export const useJamStore = create<JamStore>((set) => ({
  session: null,
  availableTracks: [],
  selectedTrackId: null,
  isRecording: false,

  setSession: (session) => set({ session }),
  setAvailableTracks: (tracks) => set({ availableTracks: tracks }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  setRecording: (recording) => set({ isRecording: recording }),
}))
