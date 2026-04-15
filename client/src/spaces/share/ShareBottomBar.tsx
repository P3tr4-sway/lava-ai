import { useState, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  Lock,
  Music2,
  ChevronUp,
  ChevronDown,
  Minus,
  Plus,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui'

interface ShareBottomBarProps {
  duration: number
  previewLimit?: number | null // null = no limit (logged in)
  onUpgradeClick?: () => void
  className?: string
}

const SPEEDS = [0.5, 0.75, 1, 1.25] as const
type Speed = (typeof SPEEDS)[number]

export function ShareBottomBar({
  duration,
  previewLimit = null,
  onUpgradeClick,
  className,
}: ShareBottomBarProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [hitLimit, setHitLimit] = useState(false)

  // Practice tools state
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [transpose, setTranspose] = useState(0)
  const [speed, setSpeed] = useState<Speed>(1)
  const [bpm, setBpm] = useState(120)
  const [activePanel, setActivePanel] = useState<'metronome' | 'transpose' | 'speed' | null>(null)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const previewPercent = previewLimit && duration > 0 ? (previewLimit / duration) * 100 : 100
  const isLimited = previewLimit !== null

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handlePlay = useCallback(() => {
    if (hitLimit) { onUpgradeClick?.(); return }
    setIsPlaying((p) => !p)
  }, [hitLimit, onUpgradeClick])

  const handleRestart = useCallback(() => {
    setCurrentTime(0)
    setHitLimit(false)
    setIsPlaying(false)
  }, [])

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const seekTime = (Number(e.target.value) / 100) * duration
      if (previewLimit !== null && seekTime > previewLimit) {
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

  const togglePanel = (panel: typeof activePanel) =>
    setActivePanel((p) => (p === panel ? null : panel))

  return (
    <div className={cn('fixed bottom-0 left-0 right-0 z-50 flex flex-col', className)}>
      {/* Practice tool sub-panels */}
      {activePanel && (
        <div className="bg-surface-1 border-t border-border px-4 py-3 flex items-center gap-6 animate-fade-in">
          {activePanel === 'metronome' && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-text-secondary font-medium w-20">Metronome</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBpm((b) => Math.max(40, b - 5))}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="text-sm font-mono text-text-primary w-12 text-center tabular-nums">
                  {bpm} BPM
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBpm((b) => Math.min(240, b + 5))}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {[1, 2, 3, 4].map((beat) => (
                  <div
                    key={beat}
                    className={cn(
                      'size-2.5 rounded-full border border-border transition-colors',
                      metronomeOn && beat === 1 ? 'bg-accent' : 'bg-surface-3',
                    )}
                  />
                ))}
              </div>
              <button
                onClick={() => setMetronomeOn((m) => !m)}
                className={cn(
                  'text-xs px-3 py-1 rounded border transition-colors',
                  metronomeOn
                    ? 'bg-accent text-surface-0 border-accent'
                    : 'border-border text-text-secondary hover:border-border-hover',
                )}
              >
                {metronomeOn ? 'On' : 'Off'}
              </button>
            </div>
          )}

          {activePanel === 'transpose' && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-text-secondary font-medium w-20">Transpose</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTranspose((t) => Math.max(-12, t - 1))}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="text-sm font-mono text-text-primary w-16 text-center tabular-nums">
                  {transpose > 0 ? `+${transpose}` : transpose} st
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTranspose((t) => Math.min(12, t + 1))}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {transpose !== 0 && (
                <button
                  onClick={() => setTranspose(0)}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {activePanel === 'speed' && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-text-secondary font-medium w-20">Speed</span>
              <div className="flex items-center gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      'px-3 py-1 text-xs rounded border transition-colors',
                      speed === s
                        ? 'bg-accent text-surface-0 border-accent'
                        : 'border-border text-text-secondary hover:border-border-hover',
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main bar */}
      <div className="bg-surface-1/95 backdrop-blur-md border-t border-border">
        {/* Progress track */}
        <div className="relative h-1 w-full bg-surface-3 cursor-pointer">
          <div
            className="absolute inset-y-0 left-0 bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
          {isLimited && (
            <div
              className="absolute top-0 bottom-0 w-px bg-warning/70"
              style={{ left: `${previewPercent}%` }}
            />
          )}
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

        {/* Controls row */}
        <div className="flex items-center gap-2 px-4 py-2 max-w-6xl mx-auto">
          {/* Transport */}
          <Button variant="ghost" size="icon-sm" onClick={handleRestart}>
            <SkipBack className="size-4" />
          </Button>
          <button
            onClick={handlePlay}
            className={cn(
              'size-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
              hitLimit
                ? 'bg-warning text-surface-0'
                : 'bg-accent text-surface-0 hover:opacity-90',
            )}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </button>

          {/* Time */}
          <span className="text-xs text-text-secondary font-mono tabular-nums ml-1">
            {formatTime(currentTime)}
            <span className="text-text-muted"> / {formatTime(duration)}</span>
          </span>

          {hitLimit && (
            <span className="text-xs text-warning ml-1 animate-fade-in hidden sm:inline">
              Preview ends here
            </span>
          )}

          <div className="flex-1" />

          {/* Practice tools */}
          <div className="flex items-center gap-0.5">
            {/* Metronome */}
            {isLimited ? (
              <Button variant="ghost" size="icon-sm" onClick={onUpgradeClick} title="Metronome — login required">
                <div className="relative">
                  <Music2 className="size-4 text-text-muted" />
                  <Lock className="size-2.5 absolute -bottom-0.5 -right-0.5 text-warning" />
                </div>
              </Button>
            ) : (
              <button
                onClick={() => togglePanel('metronome')}
                className={cn(
                  'h-7 px-2.5 text-xs rounded flex items-center gap-1.5 transition-colors',
                  activePanel === 'metronome'
                    ? 'bg-surface-3 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                  metronomeOn && 'text-accent',
                )}
              >
                <Music2 className="size-3.5" />
                <span className="hidden sm:inline">Metro</span>
                {activePanel === 'metronome' ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronUp className="size-3" />
                )}
              </button>
            )}

            {/* Transpose */}
            {isLimited ? (
              <Button variant="ghost" size="icon-sm" onClick={onUpgradeClick} title="Transpose — login required">
                <div className="relative">
                  <span className="text-[10px] font-bold text-text-muted leading-none">♭♯</span>
                  <Lock className="size-2.5 absolute -bottom-0.5 -right-0.5 text-warning" />
                </div>
              </Button>
            ) : (
              <button
                onClick={() => togglePanel('transpose')}
                className={cn(
                  'h-7 px-2.5 text-xs rounded flex items-center gap-1.5 transition-colors',
                  activePanel === 'transpose'
                    ? 'bg-surface-3 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                  transpose !== 0 && 'text-accent',
                )}
              >
                <span className="text-[11px] font-bold leading-none">♭♯</span>
                {transpose !== 0 && (
                  <span className="font-mono">{transpose > 0 ? `+${transpose}` : transpose}</span>
                )}
                <span className="hidden sm:inline">Transpose</span>
                {activePanel === 'transpose' ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronUp className="size-3" />
                )}
              </button>
            )}

            {/* Speed */}
            {isLimited ? (
              <Button variant="ghost" size="icon-sm" onClick={onUpgradeClick} title="Speed — login required">
                <div className="relative">
                  <span className="text-[10px] font-bold text-text-muted leading-none">1×</span>
                  <Lock className="size-2.5 absolute -bottom-0.5 -right-0.5 text-warning" />
                </div>
              </Button>
            ) : (
              <button
                onClick={() => togglePanel('speed')}
                className={cn(
                  'h-7 px-2.5 text-xs rounded flex items-center gap-1.5 transition-colors',
                  activePanel === 'speed'
                    ? 'bg-surface-3 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                  speed !== 1 && 'text-accent',
                )}
              >
                <span className="text-[11px] font-bold leading-none">{speed}×</span>
                <span className="hidden sm:inline">Speed</span>
                {activePanel === 'speed' ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronUp className="size-3" />
                )}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-border mx-1" />

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
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false) }}
            className="w-16 h-1 appearance-none rounded cursor-pointer bg-surface-4 accent-accent hidden sm:block"
          />
        </div>
      </div>
    </div>
  )
}
