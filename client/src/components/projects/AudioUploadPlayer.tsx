import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Pause, Play, X } from 'lucide-react'
import { cn } from '@/components/ui/utils'

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

interface AudioUploadPlayerProps {
  file: File
  onRemove: () => void
}

export function AudioUploadPlayer({ file, onRemove }: AudioUploadPlayerProps) {
  const waveContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [wsReady, setWsReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Create and revoke an object URL tied to the file lifetime
  useEffect(() => {
    const container = waveContainerRef.current
    if (!container) return

    const url = URL.createObjectURL(file)

    const ws = WaveSurfer.create({
      container,
      waveColor: 'rgba(120,120,120,0.35)',
      progressColor: '#0088ff',
      cursorColor: '#0088ff',
      cursorWidth: 2,
      height: 36,
      barWidth: 3,
      barGap: 2,
      barRadius: 100,
      normalize: true,
      interact: true,
    })
    wsRef.current = ws

    ws.load(url)
    ws.on('ready', () => {
      setDuration(ws.getDuration())
      setWsReady(true)
    })
    ws.on('timeupdate', (t) => setCurrentTime(t))
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    return () => {
      ws.destroy()
      wsRef.current = null
      URL.revokeObjectURL(url)
      setWsReady(false)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    }
  }, [file])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="relative rounded-[28px] border border-white/40 bg-white/30 p-5 shadow-[0px_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-sm">
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove audio file"
        className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full text-[#888] transition-colors hover:bg-black/10 hover:text-[#111]"
      >
        <X size={13} />
      </button>

      {/* File name */}
      <p className="mb-3 truncate pr-6 text-[12px] font-medium text-[#555]">{file.name}</p>

      {/* Player row */}
      <div className="flex items-center gap-3">
        {/* Play/pause — orange fill per Figma 56-3293 */}
        <button
          type="button"
          onClick={() => wsRef.current?.playPause()}
          disabled={!wsReady}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#ff8d28] text-white shadow-sm transition-opacity hover:opacity-90',
            !wsReady && 'cursor-not-allowed opacity-40',
          )}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        {/* WaveSurfer waveform container */}
        <div ref={waveContainerRef} className="min-w-0 flex-1" />

        {/* Time display */}
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#7b7b75]">
          {fmtTime(currentTime)}&thinsp;/&thinsp;{duration > 0 ? fmtTime(duration) : '--:--'}
        </span>
      </div>

      {/* Progress bar — Figma 56-3294: gray track + blue fill */}
      <div className="mx-1 mt-3 h-[6px] overflow-hidden rounded-full bg-[rgba(120,120,120,0.2)]">
        <div
          className="h-full rounded-full bg-[#0088ff] transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
