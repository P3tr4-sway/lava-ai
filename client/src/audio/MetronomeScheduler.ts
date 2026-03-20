import { Scheduler } from './Scheduler'
import { AudioEngine } from './AudioEngine'
import {
  METRONOME_FREQ_BAR,
  METRONOME_FREQ_BEAT,
  METRONOME_DECAY_SEC,
} from './constants'

export class MetronomeScheduler {
  private scheduler: Scheduler
  private enabled = false
  private beatsPerBar: number
  private bpm: number

  constructor(beatsPerBar = 4, bpm = 120) {
    this.beatsPerBar = beatsPerBar
    this.bpm = bpm
    this.scheduler = new Scheduler(bpm)

    // Register beat callback with the Scheduler's onBeat interface
    this.scheduler.onBeat((time: number, beat: number) => {
      if (!this.enabled) return
      const isDownbeat = beat % this.beatsPerBar === 0
      this.scheduleTick(time, isDownbeat)
    })
  }

  private scheduleTick(time: number, isDownbeat: boolean): void {
    const engine = AudioEngine.getInstance()
    const ctx = engine.context
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = isDownbeat ? METRONOME_FREQ_BAR : METRONOME_FREQ_BEAT
    gain.gain.setValueAtTime(isDownbeat ? 0.5 : 0.3, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + METRONOME_DECAY_SEC)
    osc.connect(gain)
    gain.connect(engine.masterGain) // directly to masterGain — subject to master volume
    osc.start(time)
    osc.stop(time + METRONOME_DECAY_SEC + 0.01)
  }

  start(fromBar: number, beatsPerBar?: number): void {
    if (beatsPerBar !== undefined) this.beatsPerBar = beatsPerBar
    const fromBeat = Math.round(fromBar * this.beatsPerBar)
    this.scheduler.setBpm(this.bpm)
    this.scheduler.start(fromBeat)
  }

  stop(): void {
    this.scheduler.stop()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
    this.scheduler.setBpm(bpm)
  }

  setBeatsPerBar(beatsPerBar: number): void {
    this.beatsPerBar = beatsPerBar
  }
}
