import { create } from 'zustand'
import type { JamSession, Loop } from '@lava/shared'

interface JamStore {
  session: JamSession | null
  availableLoops: Loop[]
  isRecording: boolean

  setSession: (session: JamSession | null) => void
  setAvailableLoops: (loops: Loop[]) => void
  toggleLoop: (loopId: string) => void
  setRecording: (recording: boolean) => void
}

export const useJamStore = create<JamStore>((set) => ({
  session: null,
  availableLoops: [],
  isRecording: false,

  setSession: (session) => set({ session }),
  setAvailableLoops: (loops) => set({ availableLoops: loops }),

  toggleLoop: (loopId) =>
    set((state) => {
      if (!state.session) return {}
      const active = state.session.activeLoops
      const next = active.includes(loopId)
        ? active.filter((id) => id !== loopId)
        : [...active, loopId]
      return { session: { ...state.session, activeLoops: next } }
    }),

  setRecording: (recording) => set({ isRecording: recording }),
}))
