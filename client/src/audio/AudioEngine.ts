/**
 * Singleton Web Audio engine. Runs outside React state — components
 * poll via requestAnimationFrame refs for visualization data.
 */
import type { Clip, TrackNode } from './types'

export class AudioEngine {
  private static instance: AudioEngine | null = null

  readonly context: AudioContext
  readonly masterGain: GainNode
  readonly analyser: AnalyserNode

  // --- multi-track node management ---
  private trackNodes = new Map<string, TrackNode>()
  private savedVolumes = new Map<string, number>() // pre-mute volumes
  private soloedTracks = new Set<string>()

  // --- playback state ---
  private activeSources = new Map<string, AudioBufferSourceNode[]>()
  private bufferCache = new Map<string, AudioBuffer>()
  private playStartContextTime = 0
  private playStartBar = 0
  private pausedAtBar = 0
  private isPlaying = false
  private bpm = 120
  private beatsPerBar = 4

  private constructor() {
    this.context = new AudioContext({ sampleRate: 44100 })
    this.masterGain = this.context.createGain()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048

    this.masterGain.connect(this.analyser)
    this.analyser.connect(this.context.destination)
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine()
    }
    return AudioEngine.instance
  }

  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  setMasterVolume(vol: number) {
    this.masterGain.gain.setTargetAtTime(vol, this.context.currentTime, 0.01)
  }

  getWaveformData(): Float32Array {
    const data = new Float32Array(this.analyser.frequencyBinCount)
    this.analyser.getFloatTimeDomainData(data)
    return data
  }

  getFrequencyData(): Uint8Array {
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return data
  }

  // ---------------------------------------------------------------------------
  // C. Track node management
  // ---------------------------------------------------------------------------

  createTrackNodes(trackId: string): TrackNode {
    const gainNode = this.context.createGain()
    const pannerNode = this.context.createStereoPanner()
    const analyserNode = this.context.createAnalyser()
    analyserNode.fftSize = 1024
    // routing: gain → panner → masterGain
    gainNode.connect(pannerNode)
    pannerNode.connect(this.masterGain)
    const node: TrackNode = { gainNode, pannerNode, analyserNode }
    this.trackNodes.set(trackId, node)
    this.savedVolumes.set(trackId, 1.0)
    return node
  }

  destroyTrackNodes(trackId: string): void {
    const node = this.trackNodes.get(trackId)
    if (!node) return
    node.gainNode.disconnect()
    node.pannerNode.disconnect()
    node.analyserNode.disconnect()
    this.trackNodes.delete(trackId)
    this.savedVolumes.delete(trackId)
  }

  setTrackVolume(trackId: string, volume: number): void {
    // volume: 0.0 to 1.0
    const node = this.trackNodes.get(trackId)
    if (!node) return
    node.gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.01)
    if (volume > 0) this.savedVolumes.set(trackId, volume)
  }

  setTrackPan(trackId: string, pan: number): void {
    // pan: -1.0 to 1.0
    const node = this.trackNodes.get(trackId)
    if (!node) return
    node.pannerNode.pan.setTargetAtTime(pan, this.context.currentTime, 0.01)
  }

  muteTrack(trackId: string, muted: boolean): void {
    const node = this.trackNodes.get(trackId)
    if (!node) return
    if (muted) {
      node.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.01)
    } else {
      const vol = this.savedVolumes.get(trackId) ?? 1.0
      node.gainNode.gain.setTargetAtTime(vol, this.context.currentTime, 0.01)
    }
  }

  soloTrack(trackId: string, soloed: boolean): void {
    if (soloed) {
      this.soloedTracks.add(trackId)
    } else {
      this.soloedTracks.delete(trackId)
    }
    // update all track gains: when solo is active, non-soloed tracks are silenced
    if (this.soloedTracks.size > 0) {
      for (const [id, node] of this.trackNodes) {
        const shouldHear = this.soloedTracks.has(id)
        const vol = shouldHear ? (this.savedVolumes.get(id) ?? 1.0) : 0
        node.gainNode.gain.setTargetAtTime(vol, this.context.currentTime, 0.01)
      }
    } else {
      // no solo active — restore all tracks
      for (const [id, node] of this.trackNodes) {
        const vol = this.savedVolumes.get(id) ?? 1.0
        node.gainNode.gain.setTargetAtTime(vol, this.context.currentTime, 0.01)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // D. AudioBuffer loading
  // ---------------------------------------------------------------------------

  async loadBuffer(audioFileId: string): Promise<AudioBuffer> {
    if (this.bufferCache.has(audioFileId)) {
      return this.bufferCache.get(audioFileId)!
    }
    await this.resume()
    const response = await fetch(`/api/audio/${audioFileId}`)
    if (!response.ok) throw new Error(`Failed to load audio: ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer)
    this.bufferCache.set(audioFileId, audioBuffer)
    return audioBuffer
  }

  clearBufferCache(): void {
    this.bufferCache.clear()
  }

  // ---------------------------------------------------------------------------
  // E. Playback scheduling
  // ---------------------------------------------------------------------------

  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  setBeatsPerBar(bpb: number): void {
    this.beatsPerBar = bpb
  }

  private barToSeconds(bars: number): number {
    // bars → seconds, based on bpm and beatsPerBar
    return bars * this.beatsPerBar * (60 / this.bpm)
  }

  private scheduleClip(clip: Clip, fromBar: number): void {
    if (!clip.audioBuffer) return
    const node = this.trackNodes.get(clip.trackId)
    if (!node) return

    const barDuration = this.barToSeconds(1)
    const clipStartSec = this.barToSeconds(clip.startBar)
    const playheadSec = this.barToSeconds(fromBar)
    const trimStartSec = clip.trimStart * barDuration
    const clipDurationSec = (clip.lengthInBars - clip.trimStart - clip.trimEnd) * barDuration

    let when: number
    let offset: number
    let duration: number

    if (clipStartSec >= playheadSec) {
      // clip hasn't been reached yet — schedule from its start
      when = this.playStartContextTime + (clipStartSec - playheadSec)
      offset = trimStartSec
      duration = clipDurationSec
    } else {
      // playhead is already inside the clip (seek into middle of clip)
      const seekedIntoClip = playheadSec - clipStartSec
      offset = seekedIntoClip + trimStartSec
      duration = clipDurationSec - seekedIntoClip
      if (duration <= 0) return // clip is already over — skip
      when = this.playStartContextTime
    }

    // clip must be within the valid AudioBuffer range
    if (offset >= clip.audioBuffer.duration) return

    const source = this.context.createBufferSource()
    source.buffer = clip.audioBuffer
    source.connect(node.gainNode)
    source.start(when, offset, duration)
    source.onended = () => {
      const sources = this.activeSources.get(clip.trackId) ?? []
      const idx = sources.indexOf(source)
      if (idx >= 0) sources.splice(idx, 1)
    }

    const existing = this.activeSources.get(clip.trackId) ?? []
    existing.push(source)
    this.activeSources.set(clip.trackId, existing)
  }

  async play(fromBar: number, clips: Clip[]): Promise<void> {
    await this.resume()
    this.stopAllSources() // clear any existing source nodes
    this.playStartContextTime = this.context.currentTime
    this.playStartBar = fromBar
    this.isPlaying = true

    // schedule all clips that intersect with the playhead position
    for (const clip of clips) {
      const clipEnd = clip.startBar + clip.lengthInBars
      if (clipEnd <= fromBar) continue // clip is entirely before the playhead
      this.scheduleClip(clip, fromBar)
    }
  }

  pause(): void {
    this.pausedAtBar = this.getCurrentBar()
    this.stopAllSources()
    this.isPlaying = false
  }

  stop(): void {
    this.stopAllSources()
    this.playStartBar = 0
    this.pausedAtBar = 0
    this.isPlaying = false
  }

  private stopAllSources(): void {
    for (const [, sources] of this.activeSources) {
      for (const source of sources) {
        try {
          source.stop()
        } catch {
          // already stopped — ignore
        }
      }
    }
    this.activeSources.clear()
  }

  getCurrentBar(): number {
    if (!this.isPlaying) return this.pausedAtBar
    const elapsed = this.context.currentTime - this.playStartContextTime
    const elapsedBars = elapsed / this.barToSeconds(1)
    return this.playStartBar + elapsedBars
  }

  getCurrentTimeSec(): number {
    return this.barToSeconds(this.getCurrentBar())
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getPausedAtBar(): number {
    return this.pausedAtBar
  }
}
