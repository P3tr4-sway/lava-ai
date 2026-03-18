export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a' | 'aac'

export interface AudioFile {
  id: string
  name: string
  format: AudioFormat
  duration: number
  sampleRate: number
  channels: number
  size: number
  url: string
  createdAt: number
}

export interface AudioRegion {
  id: string
  startTime: number
  endTime: number
  label?: string
}
