export type LoopType = 'drum' | 'bass' | 'chord' | 'melody' | 'custom'

export interface Loop {
  id: string
  name: string
  type: LoopType
  bpm: number
  bars: number
  key: string
  audioUrl: string
}

export interface BackingTrack {
  id: string
  name: string
  genre: string
  bpm: number
  key: string
  audioUrl: string
  loops: Loop[]
}

export interface JamSession {
  id: string
  projectId: string
  bpm: number
  key: string
  scale: string
  activeLoops: string[]
  backingTrackId?: string
  startedAt: number
}
