export type TrackType = 'audio' | 'midi' | 'instrument' | 'bus'

export interface Region {
  id: string
  trackId: string
  startTime: number
  duration: number
  offset: number
  audioFileId?: string
  midiData?: string
  name: string
  color?: string
}

export interface EffectInstance {
  id: string
  type: string
  enabled: boolean
  params: Record<string, number>
}

export interface Track {
  id: string
  name: string
  type: TrackType
  volume: number
  pan: number
  muted: boolean
  soloed: boolean
  armed: boolean
  color: string
  effects: EffectInstance[]
  regions: Region[]
  order: number
}

export interface MixerBus {
  id: string
  name: string
  volume: number
  effects: EffectInstance[]
}
