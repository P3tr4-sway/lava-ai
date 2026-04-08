import { useState, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  Lock,
  Repeat,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui'
import { Slider } from '@/components/ui'

interface SharePlaybackBarProps {
  className?: string
  /** Total duration in seconds */
  duration: number
  /** Free preview limit in seconds — playback stops here for non-paying users */
  previewLimit: number
  onUpgradeClick?: () => void
}

export function SharePlaybackBar({
  className,
  duration,
  previewLimit,
  onUpgradeClick,
}: SharePlaybackBarProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [hitLimit, setHitLimit] = useState(false)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const previewPercent = duration > 0 ? (previewLimit / duration) * 100 : 100

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handlePlay = useCallback(() => {
    if (hitLimit) {
      onUpgradeClick?.()
      return
    }
    setIsPlaying((p) => !p)
  }, [hitLimit, onUpgradeClick])

  const handleRestart = useCallback(() => {
    setCurrentTime(0)
    setHitLimit(false)
    setIsPlaying(false)
  }, [])

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value)
      const seekTime = (val / 100) * duration
      if (seekTime > previewLimit) {
        setCurrentTime(previewLimit)
        setHitLimit(true)
        setIsPlaying(false)
      } else {
        setCurrentTime(seekTime)
        setHitLimit(false)
      }
    },
    [duration, previewLimit],
  )

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-surface-1/95 backdrop-blur-md border-t border-border',
        className,
      )}
    >
      {/* Progress bar */}
      <div className="relative h-1 w-full bg-surface-3 cursor-pointer group">
        {/* Played portion */}
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-all"
          style={{ width: `${progress}%` }}
        />
        {/* Preview limit marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-warning/60"
          style={{ left: `${previewPercent}%` }}
        />
        {/* Free zone overlay for locked portion */}
        <div
          className="absolute inset-y-0 right-0 bg-surface-0/30"
          style={{ left: `${previewPercent}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={handleSeek}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-5xl mx-auto">
        {/* Left: Transport */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={handleRestart}>
            <SkipBack className="size-4" />
          </Button>
          <button
            onClick={handlePlay}
            className={cn(
              'size-9 rounded-full flex items-center justify-center transition-colors',
              hitLimit
                ? 'bg-warning text-surface-0'
                : 'bg-accent text-surface-0 hover:opacity-90',
            )}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </button>
        </div>

        {/* Center: Time */}
        <span className="text-xs text-text-secondary font-mono tabular-nums min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Seek hint when limit hit */}
        {hitLimit && (
          <span className="text-xs text-warning animate-fade-in">
            Preview ends here
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Locked features + Volume */}
        <div className="flex items-center gap-1">
          {/* Locked: Loop */}
          <Button variant="ghost" size="icon-sm" onClick={onUpgradeClick} title="Loop — Pro feature">
            <div className="relative">
              <Repeat className="size-4 text-text-muted" />
              <Lock className="size-2.5 absolute -bottom-0.5 -right-0.5 text-warning" />
            </div>
          </Button>

          {/* Locked: Speed */}
          <Button variant="ghost" size="icon-sm" onClick={onUpgradeClick} title="Speed — Pro feature">
            <div className="relative">
              <SlidersHorizontal className="size-4 text-text-muted" />
              <Lock className="size-2.5 absolute -bottom-0.5 -right-0.5 text-warning" />
            </div>
          </Button>

          {/* Volume */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsMuted((m) => !m)}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
          <div className="w-20 hidden sm:block">
            <Slider
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value))
                setIsMuted(false)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
