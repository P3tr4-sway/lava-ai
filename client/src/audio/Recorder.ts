import * as Tone from 'tone'

export class Recorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null
  private liveAnalyser: AnalyserNode | null = null
  private mimeType = ''

  async requestPermission(): Promise<'granted' | 'denied'> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // Save stream for reuse in start()
      this.stream = stream
      return 'granted'
    } catch {
      return 'denied'
    }
  }

  async start(_trackId: string, _startBar: number): Promise<void> {
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }

    // Negotiate mimeType for cross-browser compatibility
    this.mimeType =
      ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm', ''].find(
        (t) => t === '' || MediaRecorder.isTypeSupported(t)
      ) ?? ''

    // Create liveAnalyser for oscilloscope visualisation
    // Note: deliberately NOT connected to masterGain to prevent monitoring echo
    const ctx = Tone.getContext().rawContext as AudioContext
    this.liveAnalyser = ctx.createAnalyser()
    this.liveAnalyser.fftSize = 2048
    const source = ctx.createMediaStreamSource(this.stream)
    source.connect(this.liveAnalyser)

    // Start MediaRecorder with 100ms chunk interval
    this.chunks = []
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined
    )
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.mediaRecorder.start(100)
  }

  async stop(): Promise<{ blob: Blob; audioBuffer: AudioBuffer }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Not recording'))
        return
      }
      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' })
          const arrayBuffer = await blob.arrayBuffer()
          const audioBuffer = await (Tone.getContext().rawContext as AudioContext).decodeAudioData(arrayBuffer)
          resolve({ blob, audioBuffer })
        } catch (err) {
          reject(err)
        }
      }
      this.mediaRecorder.stop()
      // Disconnect liveAnalyser
      this.liveAnalyser = null
    })
  }

  getLiveWaveform(): Float32Array {
    if (!this.liveAnalyser) return new Float32Array(0)
    const data = new Float32Array(this.liveAnalyser.fftSize)
    this.liveAnalyser.getFloatTimeDomainData(data)
    return data
  }

  stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}
