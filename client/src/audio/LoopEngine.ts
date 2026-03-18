import { AudioEngine } from './AudioEngine'

interface LoopTrack {
  id: string
  buffer: AudioBuffer
  source: AudioBufferSourceNode | null
  gainNode: GainNode
}

export class LoopEngine {
  private engine: AudioEngine
  private tracks = new Map<string, LoopTrack>()
  private isPlaying = false

  constructor() {
    this.engine = AudioEngine.getInstance()
  }

  async loadLoop(id: string, url: string): Promise<void> {
    const ctx = this.engine.context
    const res = await fetch(url)
    const arrayBuffer = await res.arrayBuffer()
    const buffer = await ctx.decodeAudioData(arrayBuffer)

    const gainNode = ctx.createGain()
    gainNode.connect(this.engine.masterGain)

    this.tracks.set(id, { id, buffer, source: null, gainNode })
  }

  activateLoop(id: string) {
    const track = this.tracks.get(id)
    if (!track || !this.isPlaying) return

    const ctx = this.engine.context
    const source = ctx.createBufferSource()
    source.buffer = track.buffer
    source.loop = true
    source.connect(track.gainNode)
    source.start(ctx.currentTime)
    track.source = source
  }

  deactivateLoop(id: string) {
    const track = this.tracks.get(id)
    if (!track?.source) return
    track.source.stop()
    track.source = null
  }

  start() {
    this.isPlaying = true
    for (const [id] of this.tracks) {
      this.activateLoop(id)
    }
  }

  stop() {
    this.isPlaying = false
    for (const [id] of this.tracks) {
      this.deactivateLoop(id)
    }
  }

  setLoopVolume(id: string, volume: number) {
    const track = this.tracks.get(id)
    if (track) {
      track.gainNode.gain.setTargetAtTime(volume, this.engine.context.currentTime, 0.01)
    }
  }
}
