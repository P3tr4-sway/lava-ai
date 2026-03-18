import { AudioEngine } from './AudioEngine'

export class Metronome {
  private engine: AudioEngine
  private bpm: number
  private intervalId: number | null = null

  constructor(bpm = 120) {
    this.engine = AudioEngine.getInstance()
    this.bpm = bpm
  }

  start() {
    this.stop()
    const interval = (60 / this.bpm) * 1000
    this.tick()
    this.intervalId = window.setInterval(() => this.tick(), interval)
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  setBpm(bpm: number) {
    const wasRunning = this.intervalId !== null
    this.bpm = bpm
    if (wasRunning) {
      this.start()
    }
  }

  private tick() {
    const ctx = this.engine.context
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)

    osc.connect(gain)
    gain.connect(this.engine.masterGain)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.05)
  }
}
