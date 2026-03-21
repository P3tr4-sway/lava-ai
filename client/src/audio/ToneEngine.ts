/**
 * Singleton audio engine wrapping Tone.js for Transport scheduling and
 * raw Web Audio API for per-track routing (GainNode + StereoPannerNode).
 *
 * Replaces the original AudioEngine. Tone.js handles BPM-aware scheduling,
 * play/pause/stop, and clip playback. Raw Web Audio nodes handle per-track
 * volume, pan, mute, and solo — the same proven approach as the original
 * AudioEngine, avoiding Tone.Channel compatibility issues.
 */
import * as Tone from 'tone'
import type { Clip } from './types'
import type { TransportRange } from '../stores/audioStore'

interface TrackNodes {
  gainNode: GainNode
  pannerNode: StereoPannerNode
}

export class ToneEngine {
  private static instance: ToneEngine | null = null

  private masterGain: GainNode | null = null
  private analyserNode: AnalyserNode | null = null

  // --- multi-track node management ---
  private trackNodes = new Map<string, TrackNodes>()
  private savedVolumes = new Map<string, number>()
  private soloedTracks = new Set<string>()

  // --- playback state ---
  private activePlayers = new Map<string, Tone.Player[]>()
  private bufferCache = new Map<string, AudioBuffer>()
  private bpm = 120
  private beatsPerBar = 4
  private initialized = false
  private activeLoop: TransportRange | null = null

  private constructor() {
    // Eagerly set up the raw Web Audio routing graph.
    // Tone.js creates a default AudioContext on import — we piggyback on it.
    const ctx = Tone.getContext().rawContext as AudioContext

    this.masterGain = ctx.createGain()
    this.analyserNode = ctx.createAnalyser()
    this.analyserNode.fftSize = 2048

    this.masterGain.connect(this.analyserNode)
    this.analyserNode.connect(ctx.destination)

    Tone.getTransport().bpm.value = this.bpm
  }

  static getInstance(): ToneEngine {
    if (!ToneEngine.instance) {
      ToneEngine.instance = new ToneEngine()
    }
    return ToneEngine.instance
  }

  // ---------------------------------------------------------------------------
  // Initialization — resumes AudioContext (requires user gesture)
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    if (this.initialized) return
    await Tone.start()
    const ctx = Tone.getContext().rawContext as AudioContext
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    this.initialized = true
  }

  // ---------------------------------------------------------------------------
  // Master controls
  // ---------------------------------------------------------------------------

  setMasterVolume(vol: number): void {
    if (!this.masterGain) return
    this.masterGain.gain.setTargetAtTime(vol, Tone.now(), 0.01)
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
    Tone.getTransport().bpm.value = bpm
  }

  setBeatsPerBar(bpb: number): void {
    this.beatsPerBar = bpb
  }

  // ---------------------------------------------------------------------------
  // Track node management (raw Web Audio — same approach as original AudioEngine)
  // ---------------------------------------------------------------------------

  createTrack(trackId: string): TrackNodes {
    const ctx = Tone.getContext().rawContext as AudioContext
    const gainNode = ctx.createGain()
    const pannerNode = ctx.createStereoPanner()

    // routing: gain → panner → masterGain
    gainNode.connect(pannerNode)
    pannerNode.connect(this.masterGain!)

    const nodes: TrackNodes = { gainNode, pannerNode }
    this.trackNodes.set(trackId, nodes)
    this.savedVolumes.set(trackId, 1.0)
    return nodes
  }

  destroyTrack(trackId: string): void {
    const nodes = this.trackNodes.get(trackId)
    if (!nodes) return
    nodes.gainNode.disconnect()
    nodes.pannerNode.disconnect()
    this.trackNodes.delete(trackId)
    this.savedVolumes.delete(trackId)
    this.soloedTracks.delete(trackId)
  }

  setTrackVolume(trackId: string, volume: number): void {
    const nodes = this.trackNodes.get(trackId)
    if (!nodes) return
    nodes.gainNode.gain.setTargetAtTime(volume, Tone.now(), 0.01)
    if (volume > 0) this.savedVolumes.set(trackId, volume)
  }

  setTrackPan(trackId: string, pan: number): void {
    const nodes = this.trackNodes.get(trackId)
    if (!nodes) return
    nodes.pannerNode.pan.setTargetAtTime(pan, Tone.now(), 0.01)
  }

  muteTrack(trackId: string, muted: boolean): void {
    const nodes = this.trackNodes.get(trackId)
    if (!nodes) return
    if (muted) {
      nodes.gainNode.gain.setTargetAtTime(0, Tone.now(), 0.01)
    } else {
      const vol = this.savedVolumes.get(trackId) ?? 1.0
      nodes.gainNode.gain.setTargetAtTime(vol, Tone.now(), 0.01)
    }
  }

  soloTrack(trackId: string, soloed: boolean): void {
    if (soloed) {
      this.soloedTracks.add(trackId)
    } else {
      this.soloedTracks.delete(trackId)
    }
    // When any track is soloed, non-soloed tracks are silenced
    if (this.soloedTracks.size > 0) {
      for (const [id, nodes] of this.trackNodes) {
        const shouldHear = this.soloedTracks.has(id)
        const vol = shouldHear ? (this.savedVolumes.get(id) ?? 1.0) : 0
        nodes.gainNode.gain.setTargetAtTime(vol, Tone.now(), 0.01)
      }
    } else {
      // No solo active — restore all tracks
      for (const [id, nodes] of this.trackNodes) {
        const vol = this.savedVolumes.get(id) ?? 1.0
        nodes.gainNode.gain.setTargetAtTime(vol, Tone.now(), 0.01)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // AudioBuffer loading
  // ---------------------------------------------------------------------------

  async loadBuffer(audioFileId: string): Promise<AudioBuffer> {
    if (this.bufferCache.has(audioFileId)) {
      return this.bufferCache.get(audioFileId)!
    }

    await this.init()

    const url = `/api/audio/${audioFileId}`
    const toneBuffer = new Tone.ToneAudioBuffer()
    await toneBuffer.load(url)

    const raw = toneBuffer.get()
    if (!raw) throw new Error(`Failed to decode audio for fileId="${audioFileId}" url="${url}"`)
    this.bufferCache.set(audioFileId, raw)
    return raw
  }

  clearBufferCache(): void {
    this.bufferCache.clear()
  }

  // ---------------------------------------------------------------------------
  // Transport / Playback
  // ---------------------------------------------------------------------------

  async play(fromBar: number, clips: Clip[], loopRange?: TransportRange | null): Promise<void> {
    await this.init()

    this.stopAllPlayers()
    Tone.getTransport().cancel()
    this.setLoopRange(loopRange ?? null)
    Tone.getTransport().seconds = this.barToSeconds(fromBar)

    const playheadSec = this.barToSeconds(fromBar)

    for (const clip of clips) {
      const clipEnd = clip.startBar + clip.lengthInBars
      if (clipEnd <= fromBar) continue
      try {
        this.scheduleClip(clip, playheadSec)
      } catch (err) {
        console.error(`ToneEngine: failed to schedule clip ${clip.id}`, err)
      }
    }

    Tone.getTransport().start()
  }

  pause(): void {
    Tone.getTransport().pause()
    this.stopAllPlayers()
  }

  stop(): void {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    this.stopAllPlayers()
  }

  getCurrentBar(): number {
    return Tone.getTransport().seconds / this.barToSeconds(1)
  }

  getCurrentTimeSec(): number {
    return Tone.getTransport().seconds
  }

  getIsPlaying(): boolean {
    return Tone.getTransport().state === 'started'
  }

  setLoopRange(loopRange: TransportRange | null): void {
    this.activeLoop = loopRange && loopRange.enabled ? loopRange : null
    if (this.activeLoop) {
      Tone.getTransport().setLoopPoints(
        this.barToSeconds(this.activeLoop.start),
        this.barToSeconds(this.activeLoop.end),
      )
      Tone.getTransport().loop = true
    } else {
      Tone.getTransport().loop = false
    }
  }

  // ---------------------------------------------------------------------------
  // Analysis data (for visualization)
  // ---------------------------------------------------------------------------

  getWaveformData(): Float32Array {
    if (!this.analyserNode) return new Float32Array(0)
    const data = new Float32Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getFloatTimeDomainData(data)
    return data
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0)
    const data = new Uint8Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getByteFrequencyData(data)
    return data
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private barToSeconds(bars: number): number {
    return bars * this.beatsPerBar * (60 / this.bpm)
  }

  private scheduleClip(clip: Clip, playheadSec: number): void {
    if (!clip.audioBuffer) return
    const nodes = this.trackNodes.get(clip.trackId)
    if (!nodes) return

    const barDuration = this.barToSeconds(1)
    const clipStartSec = this.barToSeconds(clip.startBar)
    const trimStartSec = clip.trimStart * barDuration
    const clipDurationSec =
      (clip.lengthInBars - clip.trimStart - clip.trimEnd) * barDuration

    let transportTime: number
    let offset: number
    let duration: number

    if (clipStartSec >= playheadSec) {
      transportTime = clipStartSec
      offset = trimStartSec
      duration = clipDurationSec
    } else {
      const seekedIntoClip = playheadSec - clipStartSec
      offset = seekedIntoClip + trimStartSec
      offset = Math.min(offset, clip.audioBuffer.duration - 0.001)
      duration = clipDurationSec - seekedIntoClip
      if (duration <= 0) return
      transportTime = playheadSec
    }

    if (offset >= clip.audioBuffer.duration) return

    Tone.getTransport().schedule((time) => {
      const player = new Tone.Player(clip.audioBuffer)
      Tone.connect(player, nodes.gainNode)
      player.onstop = () => {
        try {
          player.dispose()
        } catch {
          // ignore already disposed players
        }
        const existing = this.activePlayers.get(clip.trackId) ?? []
        this.activePlayers.set(
          clip.trackId,
          existing.filter((candidate) => candidate !== player),
        )
      }
      player.start(time, offset, duration)
      const existing = this.activePlayers.get(clip.trackId) ?? []
      existing.push(player)
      this.activePlayers.set(clip.trackId, existing)
    }, transportTime)
  }

  private stopAllPlayers(): void {
    for (const [, players] of this.activePlayers) {
      for (const player of players) {
        try {
          player.stop()
          player.dispose()
        } catch {
          // already disposed — ignore
        }
      }
    }
    this.activePlayers.clear()
  }
}
