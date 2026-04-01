import { useMemo } from 'react'
import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react'
import { Slider } from '@/components/ui/Slider'
import { cn } from '@/components/ui/utils'
import { useAudioStore, type TransportState } from '@/stores/audioStore'

interface PlaybackSection {
  label: string
  type: string
  barStart: number
  barCount: number
}

interface LeadSheetPlaybackBarProps {
  totalBars: number
  beatsPerBar: number
  sections?: PlaybackSection[]
  onBarSelect?: (bar: number) => void
  className?: string
}

const SECTION_TINTS: Record<string, string> = {
  intro: 'bg-blue-400/65',
  verse: 'bg-emerald-400/65',
  chorus: 'bg-orange-300/75',
  bridge: 'bg-amber-300/75',
  outro: 'bg-rose-300/75',
  custom: 'bg-surface-4',
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = Math.floor(safeSeconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function barsToSeconds(bar: number, bpm: number, beatsPerBar: number) {
  return bar * beatsPerBar * (60 / bpm)
}

function isRunningState(state: TransportState) {
  return state !== 'stopped' && state !== 'paused' && state !== 'locating'
}

export function LeadSheetPlaybackBar({
  totalBars,
  beatsPerBar,
  sections = [],
  onBarSelect,
  className,
}: LeadSheetPlaybackBarProps) {
  const transportState = useAudioStore((s) => s.transportState)
  const setTransportState = useAudioStore((s) => s.setTransportState)
  const currentTime = useAudioStore((s) => s.currentTime)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const duration = useAudioStore((s) => s.duration)
  const currentBar = useAudioStore((s) => s.currentBar)
  const setCurrentBar = useAudioStore((s) => s.setCurrentBar)
  const bpm = useAudioStore((s) => s.bpm)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume)

  const safeTotalBars = Math.max(1, totalBars)
  const derivedDuration = barsToSeconds(safeTotalBars, bpm, beatsPerBar)
  const effectiveDuration = totalBars > 0 ? derivedDuration : Math.max(duration, 1)
  const clampedBar = Math.max(0, Math.min(currentBar, safeTotalBars))
  const sliderValue = Math.round((clampedBar / safeTotalBars) * 1000)
  const isPlaying = isRunningState(transportState)
  const currentSection = useMemo(
    () => sections.find((section) => clampedBar >= section.barStart && clampedBar < section.barStart + section.barCount),
    [clampedBar, sections],
  )
  const displayBar = Math.min(safeTotalBars, Math.max(1, Math.floor(clampedBar) + 1))

  const locateToBar = (bar: number) => {
    const nextBar = Math.max(0, Math.min(bar, safeTotalBars))
    const nextTime = barsToSeconds(nextBar, bpm, beatsPerBar)

    if (isRunningState(transportState)) {
      setTransportState('locating')
      setCurrentBar(nextBar)
      setCurrentTime(nextTime)
      setTimeout(() => setTransportState('rolling'), 0)
    } else {
      setCurrentBar(nextBar)
      setCurrentTime(nextTime)
    }

    onBarSelect?.(Math.min(Math.floor(nextBar), Math.max(0, totalBars - 1)))
  }

  const handleTogglePlayback = () => {
    if (isPlaying) {
      setTransportState('paused')
      return
    }

    if (clampedBar >= safeTotalBars) {
      setCurrentBar(0)
      setCurrentTime(0)
      onBarSelect?.(0)
    }

    setTransportState('rolling')
  }

  const handleRestart = () => {
    setTransportState('stopped')
    setCurrentBar(0)
    setCurrentTime(0)
    onBarSelect?.(0)
  }

  return (
    <div className={cn('shrink-0 border-t border-border bg-surface-0/95 backdrop-blur-sm', className)}>
      <div className="px-4 py-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1/80 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlayback}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-text-primary px-4 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-85"
                title={isPlaying ? 'Pause playback' : 'Start playback'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface-0 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                title="Back to beginning"
              >
                <RotateCcw size={15} />
                <span>Start Over</span>
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {currentSection ? currentSection.label : 'Playback'}
                  </p>
                  <p className="text-xs text-text-muted">
                    Bar {displayBar} / {safeTotalBars}
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-text-muted">
                  {formatTime(currentTime)} / {formatTime(effectiveDuration)}
                </p>
              </div>

              {sections.length > 0 && (
                <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-surface-3">
                  {sections.map((section) => (
                    <button
                      key={`${section.label}-${section.barStart}`}
                      type="button"
                      onClick={() => locateToBar(section.barStart)}
                      className={cn(
                        'h-full border-r border-surface-0/40 transition-opacity last:border-r-0 hover:opacity-100',
                        SECTION_TINTS[section.type] ?? SECTION_TINTS.custom,
                        currentSection?.barStart === section.barStart ? 'opacity-100' : 'opacity-60',
                      )}
                      style={{ width: `${(section.barCount / safeTotalBars) * 100}%` }}
                      title={`${section.label} · ${section.barCount} bars`}
                    />
                  ))}
                </div>
              )}

              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={sliderValue}
                onChange={(e) => {
                  const ratio = Number(e.target.value) / 1000
                  locateToBar(ratio * safeTotalBars)
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent"
                aria-label="Playback position"
              />
            </div>

            <div className="hidden min-w-[132px] items-center gap-2 lg:flex">
              <Volume2 size={15} className="shrink-0 text-text-muted" />
              <Slider
                min={0}
                max={100}
                value={Math.round(masterVolume * 100)}
                onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
                aria-label="Master volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
