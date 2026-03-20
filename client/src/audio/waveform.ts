/**
 * Pure utility functions for waveform generation and canvas rendering.
 * No classes, no side effects, no external dependencies.
 */

/**
 * Downsample an AudioBuffer into a peak array for waveform display.
 * @param audioBuffer Decoded audio buffer
 * @param targetSamples Number of output samples (typically the display pixel width)
 * @returns Float32Array of peak values in the range 0–1
 */
export function generatePeakData(audioBuffer: AudioBuffer, targetSamples: number): Float32Array {
  const peaks = new Float32Array(targetSamples)
  const channelCount = audioBuffer.numberOfChannels
  const samplesPerPeak = Math.floor(audioBuffer.length / targetSamples)

  for (let i = 0; i < targetSamples; i++) {
    let max = 0
    for (let c = 0; c < channelCount; c++) {
      const data = audioBuffer.getChannelData(c)
      const start = i * samplesPerPeak
      const end = Math.min(start + samplesPerPeak, audioBuffer.length)
      for (let j = start; j < end; j++) {
        const abs = Math.abs(data[j])
        if (abs > max) max = abs
      }
    }
    peaks[i] = max
  }
  return peaks
}

/**
 * Render peak data as a mirrored bar waveform onto a canvas (static, for clip content).
 */
export function renderWaveformToCanvas(
  canvas: HTMLCanvasElement,
  peakData: Float32Array,
  color: string,
  alpha = 0.8
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || peakData.length === 0) return

  const { width, height } = canvas
  const centerY = height / 2
  const barWidth = width / peakData.length

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha

  for (let i = 0; i < peakData.length; i++) {
    const peakHeight = peakData[i] * centerY
    ctx.fillRect(
      i * barWidth,
      centerY - peakHeight,
      Math.max(barWidth - 0.5, 1),
      peakHeight * 2
    )
  }
  ctx.globalAlpha = 1
}

/**
 * Render live waveform data as an oscilloscope-style polyline (used during recording).
 */
export function renderLiveWaveformToCanvas(
  canvas: HTMLCanvasElement,
  waveformData: Float32Array,
  color: string
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || waveformData.length === 0) return

  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.9
  ctx.beginPath()

  const sliceWidth = width / waveformData.length
  for (let i = 0; i < waveformData.length; i++) {
    const x = i * sliceWidth
    const y = (1 - (waveformData[i] + 1) / 2) * height
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}
