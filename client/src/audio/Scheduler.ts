import { AudioEngine } from './AudioEngine'

type ScheduledCallback = (time: number, beat: number) => void

export class Scheduler {
  private engine: AudioEngine
  private bpm: number
  private lookahead = 0.1 // seconds
  private scheduleInterval = 25 // ms
  private nextBeatTime = 0
  private currentBeat = 0
  private timerId: number | null = null
  private callbacks: ScheduledCallback[] = []

  constructor(bpm = 120) {
    this.engine = AudioEngine.getInstance()
    this.bpm = bpm
  }

  onBeat(cb: ScheduledCallback) {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter((c) => c !== cb)
    }
  }

  start(fromBeat: number = 0) {
    this.nextBeatTime = this.engine.context.currentTime
    this.currentBeat = fromBeat
    this.schedule()
    this.timerId = window.setInterval(() => this.schedule(), this.scheduleInterval)
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  setBpm(bpm: number) {
    this.bpm = bpm
  }

  private schedule() {
    const ctx = this.engine.context
    while (this.nextBeatTime < ctx.currentTime + this.lookahead) {
      for (const cb of this.callbacks) {
        cb(this.nextBeatTime, this.currentBeat)
      }
      this.nextBeatTime += 60 / this.bpm
      this.currentBeat++
    }
  }
}
