import { useEffect, useRef } from 'react'
import type { Recorder } from '@/audio/Recorder'
import { renderLiveWaveformToCanvas } from '@/audio/waveform'

interface LiveWaveformCanvasProps {
  recorder: Recorder
  color: string
  className?: string
}

export function LiveWaveformCanvas({ recorder, color, className }: LiveWaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const data = recorder.getLiveWaveform()
      if (data.length > 0) {
        renderLiveWaveformToCanvas(canvas, data, color)
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = undefined
      }
    }
  }, [recorder, color])

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'absolute inset-0 w-full h-full'}
    />
  )
}
