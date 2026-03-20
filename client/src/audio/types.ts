export interface Clip {
  id: string
  trackId: string
  startBar: number        // position in bars from bar 0
  lengthInBars: number    // duration in bars
  trimStart: number       // bars trimmed from front (default 0)
  trimEnd: number         // bars trimmed from back (default 0)
  audioFileId?: string    // server-side uploaded file id
  audioBuffer?: AudioBuffer // decoded buffer, held in memory (NOT serialized)
  peakData?: Float32Array // downsampled waveform peaks for canvas render
  name: string
  color: string
  isRecording?: boolean   // true while MediaRecorder is active on this clip
}

export interface TrackNode {
  gainNode: GainNode
  pannerNode: StereoPannerNode
  analyserNode: AnalyserNode
}
