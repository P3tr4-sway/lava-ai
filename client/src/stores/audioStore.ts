import { create } from 'zustand'

type PlaybackState = 'stopped' | 'playing' | 'paused'

interface AudioStore {
  playbackState: PlaybackState
  currentTime: number
  duration: number
  bpm: number
  masterVolume: number
  metronomeEnabled: boolean
  key: string
  currentBar: number
  loop: { start: number; end: number; enabled: boolean }

  setPlaybackState: (state: PlaybackState) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setBpm: (bpm: number) => void
  setMasterVolume: (vol: number) => void
  toggleMetronome: () => void
  setKey: (key: string) => void
  setCurrentBar: (bar: number) => void
  setLoop: (loop: { start: number; end: number; enabled: boolean }) => void
  toggleLoop: () => void
}

export const useAudioStore = create<AudioStore>((set) => ({
  playbackState: 'stopped',
  currentTime: 0,
  duration: 0,
  bpm: 120,
  masterVolume: 0.8,
  metronomeEnabled: false,
  key: 'C',
  currentBar: 0,
  loop: { start: 0, end: 4, enabled: false },

  setPlaybackState: (state) => set({ playbackState: state }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setBpm: (bpm) => set({ bpm }),
  setMasterVolume: (vol) => set({ masterVolume: vol }),
  toggleMetronome: () => set((state) => ({ metronomeEnabled: !state.metronomeEnabled })),
  setKey: (key) => set({ key }),
  setCurrentBar: (bar) => set({ currentBar: bar }),
  setLoop: (loop) => set({ loop }),
  toggleLoop: () => set((state) => ({ loop: { ...state.loop, enabled: !state.loop.enabled } })),
}))
