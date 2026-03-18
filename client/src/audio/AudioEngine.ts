/**
 * Singleton Web Audio engine. Runs outside React state — components
 * poll via requestAnimationFrame refs for visualization data.
 */
export class AudioEngine {
  private static instance: AudioEngine | null = null

  readonly context: AudioContext
  readonly masterGain: GainNode
  readonly analyser: AnalyserNode

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
}
