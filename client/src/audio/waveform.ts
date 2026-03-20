/**
 * Pure utility functions for waveform canvas rendering.
 * generatePeakData and renderWaveformToCanvas have been removed —
 * clip waveforms are now rendered by wavesurfer.js.
 */

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
