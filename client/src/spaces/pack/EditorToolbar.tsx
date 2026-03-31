import { useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  ChevronDown,
  Guitar,
  MousePointer2,
  Music,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  Spline,
  Timer,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { NoteValue, TechniqueSet } from '@lava/shared'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'
import { PlaybackStylePickerDrawer, type PlaybackStyleOption } from '@/components/score'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

interface EditorToolbarProps {
  totalBars?: number
  beatsPerBar?: number
  className?: string
}

type ToolbarPanel =
  | 'playbackSettings'
  | 'note'
  | 'notation'
  | 'chords'
  | 'view'
  | null

type PanelAnchor = { left: number; width: number } | null

const PLAYBACK_STYLE_OPTIONS: PlaybackStyleOption[] = [
  {
    id: 'clean-tab',
    label: 'Clean Tab',
    subtitle: 'Balanced',
    description: 'Neutral practice playback that stays close to the score.',
    category: 'practice',
  },
  {
    id: 'fingerstyle-room',
    label: 'Fingerstyle Room',
    subtitle: 'Acoustic',
    description: 'Dry acoustic tone for tab-heavy practice and timing work.',
    category: 'acoustic',
  },
  {
    id: 'piano-guide',
    label: 'Piano Guide',
    subtitle: 'Keys',
    description: 'Simple piano playback for checking harmony and voicing.',
    category: 'keys',
  },
  {
    id: 'band-rehearsal',
    label: 'Band Rehearsal',
    subtitle: 'Ensemble',
    description: 'A fuller backing feel when you want context while looping.',
    category: 'ensemble',
  },
]

const PLAYBACK_INSTRUMENT_OPTIONS = [
  { value: 'guitar', label: 'Guitar' },
  { value: 'nylon-guitar', label: 'Nylon Guitar' },
  { value: 'piano', label: 'Piano' },
  { value: 'bass', label: 'Bass' },
]

const PLAYBACK_RATE_OPTIONS = [
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
]

const COUNT_IN_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1 bar' },
  { value: 2, label: '2 bars' },
]

const DURATION_OPTIONS: Array<{ value: NoteValue; label: string }> = [
  { value: 'whole', label: '1' },
  { value: 'half', label: '1/2' },
  { value: 'quarter', label: '1/4' },
  { value: 'eighth', label: '1/8' },
  { value: 'sixteenth', label: '1/16' },
]

const TECHNIQUE_OPTIONS: Array<{ value: keyof TechniqueSet; label: string }> = [
  { value: 'accent', label: 'Accent' },
  { value: 'staccato', label: 'Staccato' },
  { value: 'tenuto', label: 'Tenuto' },
  { value: 'palmMute', label: 'Palm mute' },
  { value: 'harmonic', label: 'Harmonic' },
  { value: 'vibrato', label: 'Vibrato' },
]

function isRunningState(state: string) {
  return state !== 'stopped' && state !== 'paused' && state !== 'locating'
}

function barsToSeconds(bar: number, bpm: number, beatsPerBar: number) {
  return bar * beatsPerBar * (60 / bpm)
}

function durationToDivisions(duration: NoteValue, divisions: number) {
  switch (duration) {
    case 'whole':
      return divisions * 4
    case 'half':
      return divisions * 2
    case 'quarter':
      return divisions
    case 'eighth':
      return Math.max(1, Math.round(divisions / 2))
    case 'sixteenth':
      return Math.max(1, Math.round(divisions / 4))
  }
}

function ToolDivider() {
  return <div className="h-10 w-px bg-border" />
}

function RailButton({
  icon: Icon,
  label,
  active,
  highlighted,
  withChevron = false,
  panelOpen,
  onClick,
  onChevronClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  active?: boolean
  highlighted?: boolean
  withChevron?: boolean
  panelOpen?: boolean
  onClick: () => void
  onChevronClick?: (e: ReactMouseEvent) => void
}) {
  return (
    <div
      data-rail-button
      className={cn(
        'flex h-14 items-center rounded-2xl transition-all',
        highlighted
          ? 'bg-accent text-surface-0 shadow-lg'
          : active
            ? 'bg-surface-2'
            : 'hover:bg-surface-1',
      )}
    >
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={onClick}
        className={cn(
          'flex h-full items-center px-4',
          highlighted ? 'text-surface-0' : 'text-text-primary',
        )}
      >
        <Icon className="size-6" />
      </button>
      {withChevron && (
        <button
          type="button"
          aria-label={`${label} options`}
          onClick={(e) => {
            e.stopPropagation()
            onChevronClick?.(e)
          }}
          className={cn(
            'flex h-full items-center pr-3 pl-0',
            highlighted ? 'text-surface-0/90' : 'text-text-muted hover:text-text-primary',
          )}
        >
          <ChevronDown className={cn('size-4 transition-transform', panelOpen && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}

function MiniSegmentButton({
  active,
  label,
  children,
  onClick,
}: {
  active?: boolean
  label: string
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-12 min-w-12 items-center justify-center rounded-xl px-3 text-xs font-medium transition-colors',
        active ? 'bg-surface-0 text-accent shadow-sm' : 'text-text-muted hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

function PanelButton({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className={cn('h-7 rounded-lg px-2.5 text-xs', !active && 'bg-surface-0')}
    >
      {children}
    </Button>
  )
}

function PanelSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border border-border bg-surface-0 px-2 text-xs text-text-primary outline-none transition-colors focus:border-border-hover"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function EditorToolbar({
  totalBars = 16,
  beatsPerBar = 4,
  className,
}: EditorToolbarProps) {
  const [stylePickerOpen, setStylePickerOpen] = useState(false)
  const [openPanel, setOpenPanel] = useState<ToolbarPanel>(null)
  const [panelAnchor, setPanelAnchor] = useState<PanelAnchor>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const openPanelAt = (panel: ToolbarPanel, event: ReactMouseEvent) => {
    const toolbarEl = toolbarRef.current
    const buttonEl = (event.currentTarget as HTMLElement).closest('[data-rail-button]') as HTMLElement | null
    if (!toolbarEl || !buttonEl) {
      setOpenPanel((p) => p === panel ? null : panel)
      return
    }
    if (openPanel === panel) {
      setOpenPanel(null)
      setPanelAnchor(null)
      return
    }
    const toolbarRect = toolbarEl.getBoundingClientRect()
    const buttonRect = buttonEl.getBoundingClientRect()
    setPanelAnchor({
      left: buttonRect.left - toolbarRect.left + buttonRect.width / 2,
      width: buttonRect.width,
    })
    setOpenPanel(panel)
  }

  const editorMode = useEditorStore((s) => s.editorMode)
  const setEditorMode = useEditorStore((s) => s.setEditorMode)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const setToolMode = useEditorStore((s) => s.setToolMode)
  const setActiveToolGroup = useEditorStore((s) => s.setActiveToolGroup)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const showChordDiagrams = useEditorStore((s) => s.showChordDiagrams)
  const toggleChordDiagrams = useEditorStore((s) => s.toggleChordDiagrams)
  const chordDiagramGlobal = useEditorStore((s) => s.chordDiagramGlobal)
  const setChordDiagramGlobal = useEditorStore((s) => s.setChordDiagramGlobal)
  const activeToolGroup = useEditorStore((s) => s.activeToolGroup)
  const entryDuration = useEditorStore((s) => s.entryDuration)
  const setEntryDuration = useEditorStore((s) => s.setEntryDuration)
  const entryMode = useEditorStore((s) => s.entryMode)
  const setEntryMode = useEditorStore((s) => s.setEntryMode)
  const setCaret = useEditorStore((s) => s.setCaret)

  const document = useScoreDocumentStore((s) => s.document)
  const applyCommand = useScoreDocumentStore((s) => s.applyCommand)
  const track = document.tracks[0]

  const transportState = useAudioStore((s) => s.transportState)
  const setTransportState = useAudioStore((s) => s.setTransportState)
  const currentBar = useAudioStore((s) => s.currentBar)
  const setCurrentBar = useAudioStore((s) => s.setCurrentBar)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const bpm = useAudioStore((s) => s.bpm)
  const playbackRate = useAudioStore((s) => s.playbackRate)
  const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate)
  const playbackStyleId = useAudioStore((s) => s.playbackStyleId)
  const setPlaybackStyleId = useAudioStore((s) => s.setPlaybackStyleId)
  const playbackInstrument = useAudioStore((s) => s.playbackInstrument)
  const setPlaybackInstrument = useAudioStore((s) => s.setPlaybackInstrument)
  const countInBars = useAudioStore((s) => s.countInBars)
  const setCountInBars = useAudioStore((s) => s.setCountInBars)
  const metronomeEnabled = useAudioStore((s) => s.metronomeEnabled)
  const toggleMetronome = useAudioStore((s) => s.toggleMetronome)

  const safeTotalBars = Math.max(1, totalBars)
  const effectiveBpm = bpm * playbackRate
  const isPlaying = isRunningState(transportState)
  const clampedBar = Math.max(0, Math.min(currentBar, safeTotalBars))
  const displayBar = Math.min(safeTotalBars, Math.max(1, Math.floor(clampedBar) + 1))
  const sliderValue = Math.round((clampedBar / safeTotalBars) * 1000)

  const selectedNoteIds = useEditorStore((s) => s.selectedNoteIds)
  const selectedNotes = useMemo(
    () => selectedNoteIds.map((noteId) => track?.notes.find((note) => note.id === noteId)).filter(Boolean),
    [selectedNoteIds, track?.notes],
  )
  const primarySelectedNote = selectedNotes[0] ?? null

  const selectedPlaybackStyle = useMemo(
    () => PLAYBACK_STYLE_OPTIONS.find((option) => option.id === playbackStyleId) ?? PLAYBACK_STYLE_OPTIONS[0],
    [playbackStyleId],
  )

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setOpenPanel(null)
        setPanelAnchor(null)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && openPanel) {
        setOpenPanel(null)
        setPanelAnchor(null)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPanel])

  const locateToBar = (bar: number) => {
    const nextBar = Math.max(0, Math.min(bar, safeTotalBars))
    const nextTime = barsToSeconds(nextBar, effectiveBpm, beatsPerBar)
    if (isRunningState(transportState)) {
      setTransportState('locating')
      setCurrentBar(nextBar)
      setCurrentTime(nextTime)
      setTimeout(() => setTransportState('rolling'), 0)
    } else {
      setCurrentBar(nextBar)
      setCurrentTime(nextTime)
    }
  }

  const handleTogglePlayback = () => {
    if (isPlaying) {
      setTransportState('paused')
      return
    }
    if (clampedBar >= safeTotalBars) {
      setCurrentBar(0)
      setCurrentTime(0)
    }
    setTransportState('rolling')
  }

  const applyDurationToSelection = (duration: NoteValue, restMode: boolean) => {
    setEntryMode(restMode ? 'rest' : 'note')
    setEntryDuration(duration)
    setActiveToolGroup(restMode ? 'rest' : 'note')
    if (!track || selectedNotes.length === 0) return
    const durationDivisions = durationToDivisions(duration, document.divisions)
    selectedNotes.forEach((note) => {
      if (!note) return
      if (restMode !== note.isRest) {
        applyCommand({ type: 'toggleRest', trackId: track.id, noteId: note.id })
      }
      applyCommand({
        type: 'setDuration',
        trackId: track.id,
        noteId: note.id,
        durationType: duration,
        durationDivisions,
      })
    })
  }

  const toggleTechnique = (technique: keyof TechniqueSet) => {
    setActiveToolGroup('notation')
    if (!track || selectedNotes.length === 0) return
    selectedNotes.forEach((note) => {
      if (!note) return
      if (note.techniques[technique]) {
        applyCommand({ type: 'removeTechnique', trackId: track.id, noteId: note.id, technique })
      } else {
        applyCommand({ type: 'addTechnique', trackId: track.id, noteId: note.id, technique })
      }
    })
  }

  const toggleTie = () => {
    setActiveToolGroup('notation')
    if (!track || selectedNotes.length === 0) return
    selectedNotes.forEach((note) => {
      if (!note) return
      applyCommand({ type: 'toggleTie', trackId: track.id, noteId: note.id })
    })
  }

  const toggleSlur = () => {
    setActiveToolGroup('notation')
    if (!track || selectedNotes.length === 0) return
    selectedNotes.forEach((note) => {
      if (!note) return
      applyCommand({ type: 'toggleSlur', trackId: track.id, noteId: note.id })
    })
  }

  const panelContent = (() => {
    switch (openPanel) {
      case 'playbackSettings':
        return (
          <div className="space-y-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-full justify-between rounded-lg bg-surface-0 text-sm"
              onClick={() => setStylePickerOpen(true)}
            >
              {selectedPlaybackStyle.label}
              <ChevronDown className="size-3.5 text-text-muted" />
            </Button>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Position</span>
                <span>Bar {displayBar}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={sliderValue}
                onChange={(event) => locateToBar((Number(event.target.value) / 1000) * safeTotalBars)}
                aria-label={`Playback position — bar ${displayBar} of ${safeTotalBars}`}
                className={cn(
                  'block w-full cursor-pointer appearance-none bg-transparent',
                  '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border',
                  '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-border',
                  '[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent',
                  '[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent',
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PanelSelect
                label="Instrument"
                value={playbackInstrument}
                onChange={setPlaybackInstrument}
                options={PLAYBACK_INSTRUMENT_OPTIONS}
              />
              <PanelSelect
                label="Speed"
                value={String(playbackRate)}
                onChange={(value) => setPlaybackRate(Number(value))}
                options={PLAYBACK_RATE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
              />
              <PanelSelect
                label="Count-in"
                value={String(countInBars)}
                onChange={(value) => setCountInBars(Number(value))}
                options={COUNT_IN_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
              />
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-0 p-2">
                <p className="text-[10px] font-medium text-text-secondary">Metronome</p>
                <PanelButton active={metronomeEnabled} onClick={() => toggleMetronome()}>
                  {metronomeEnabled ? 'On' : 'Off'}
                </PanelButton>
              </div>
            </div>
          </div>
        )
      case 'note':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Notes</p>
            <div className="flex gap-1">
              {DURATION_OPTIONS.map((option) => (
                <PanelButton
                  key={`note-${option.value}`}
                  active={(primarySelectedNote?.durationType === option.value && !primarySelectedNote?.isRest) || (entryMode === 'note' && entryDuration === option.value)}
                  onClick={() => applyDurationToSelection(option.value, false)}
                >
                  {option.label}
                </PanelButton>
              ))}
            </div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Rests</p>
            <div className="flex gap-1">
              {DURATION_OPTIONS.map((option) => (
                <PanelButton
                  key={`rest-${option.value}`}
                  active={(primarySelectedNote?.durationType === option.value && Boolean(primarySelectedNote?.isRest)) || (entryMode === 'rest' && entryDuration === option.value)}
                  onClick={() => applyDurationToSelection(option.value, true)}
                >
                  {option.label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'notation':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Ties & Slurs</p>
            <div className="flex gap-1">
              <PanelButton active={Boolean(primarySelectedNote?.tieStart)} onClick={toggleTie}>
                Tie
              </PanelButton>
              <PanelButton active={Boolean(primarySelectedNote?.slurStart)} onClick={toggleSlur}>
                Slur
              </PanelButton>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Articulations</p>
            <div className="flex flex-wrap gap-1">
              {TECHNIQUE_OPTIONS.map((option) => (
                <PanelButton
                  key={option.value}
                  active={Boolean(primarySelectedNote?.techniques[option.value])}
                  onClick={() => toggleTechnique(option.value)}
                >
                  {option.label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'chords':
        return (
          <div className="space-y-1.5">
            {(['hidden', 'top', 'bottom', 'both'] as const).map((placement) => (
              <button
                key={placement}
                type="button"
                onClick={() => {
                  setChordDiagramGlobal(placement)
                  if (placement === 'hidden' && showChordDiagrams) toggleChordDiagrams()
                  if (placement !== 'hidden' && !showChordDiagrams) toggleChordDiagrams()
                  setOpenPanel(null)
                }}
                className={cn(
                  'flex w-full items-center rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  chordDiagramGlobal === placement
                    ? 'bg-surface-2 text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary',
                )}
              >
                {placement === 'hidden' ? 'Off' : placement.charAt(0).toUpperCase() + placement.slice(1)}
              </button>
            ))}
          </div>
        )
      case 'view':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom(zoom - 10)}
                className="flex size-7 items-center justify-center rounded-lg border border-border text-text-primary hover:bg-surface-1"
                aria-label="Zoom out"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <input
                type="range"
                min={50}
                max={200}
                step={5}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label={`Zoom level ${zoom}%`}
                className={cn(
                  'flex-1 cursor-pointer appearance-none bg-transparent',
                  '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border',
                  '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-border',
                  '[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent',
                  '[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent',
                )}
              />
              <button
                type="button"
                onClick={() => setZoom(zoom + 10)}
                className="flex size-7 items-center justify-center rounded-lg border border-border text-text-primary hover:bg-surface-1"
                aria-label="Zoom in"
              >
                <ZoomIn className="size-3.5" />
              </button>
              <input
                type="number"
                min={50}
                max={200}
                step={5}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-7 w-14 rounded-lg border border-border bg-surface-0 px-1.5 text-center text-xs text-text-primary outline-none focus:border-border-hover"
                aria-label="Zoom percentage"
              />
              <span className="text-xs text-text-muted">%</span>
            </div>
            <div className="flex gap-1">
              <PanelButton active={viewMode === 'tab'} onClick={() => setViewMode('tab')}>
                Tab
              </PanelButton>
              <PanelButton active={viewMode === 'staff'} onClick={() => setViewMode('staff')}>
                Staff
              </PanelButton>
            </div>
          </div>
        )
      default:
        return null
    }
  })()

  const activePanelContent = (() => {
    // Guard: only show panels that belong to the current mode
    if (editorMode === 'transform' && openPanel !== 'playbackSettings') return null
    if (editorMode === 'fineEdit' && openPanel === 'playbackSettings') return null
    return panelContent
  })()

  return (
    <>
      <div ref={toolbarRef} className={cn('pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2', className)}>
        {activePanelContent && (
          <div
            ref={panelRef}
            className="pointer-events-auto absolute bottom-full mb-3 w-auto min-w-[180px] max-w-[min(92vw,380px)] rounded-2xl border border-border bg-surface-0/96 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.16)] backdrop-blur"
            style={panelAnchor ? {
              left: `${panelAnchor.left}px`,
              transform: 'translateX(-50%)',
            } : {
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {activePanelContent}
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2 rounded-[32px] border border-border bg-surface-0/96 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.12)] backdrop-blur">
          <RailButton
            icon={isPlaying ? Pause : Play}
            label={isPlaying ? 'Pause playback' : 'Play score'}
            highlighted={isPlaying}
            onClick={handleTogglePlayback}
          />

          <ToolDivider />

          {editorMode === 'transform' ? (
            <>
              <RailButton
                icon={Music2}
                label="Playback style"
                onClick={() => setStylePickerOpen(true)}
              />
              <RailButton
                icon={SlidersHorizontal}
                label="Playback settings"
                active={openPanel === 'playbackSettings'}
                withChevron
                panelOpen={openPanel === 'playbackSettings'}
                onClick={() => setOpenPanel((p) => p === 'playbackSettings' ? null : 'playbackSettings')}
                onChevronClick={(e) => openPanelAt('playbackSettings', e)}
              />
              <RailButton
                icon={Timer}
                label={metronomeEnabled ? 'Metronome on' : 'Metronome off'}
                highlighted={metronomeEnabled}
                onClick={() => toggleMetronome()}
              />
            </>
          ) : (
            <>
              <RailButton
                icon={MousePointer2}
                label="Selection tools"
                active={activeToolGroup === 'selection'}
                onClick={() => {
                  setActiveToolGroup('selection')
                  setToolMode('pointer')
                  setCaret(null)
                  setOpenPanel(null)
                }}
              />
              <RailButton
                icon={Music}
                label="Notes & rests"
                active={activeToolGroup === 'note' || activeToolGroup === 'rest'}
                withChevron
                panelOpen={openPanel === 'note'}
                onClick={() => {
                  setActiveToolGroup('note')
                  setOpenPanel(null)
                }}
                onChevronClick={(e) => openPanelAt('note', e)}
              />
              <RailButton
                icon={Spline}
                label="Ties, slurs & articulations"
                active={activeToolGroup === 'notation'}
                withChevron
                panelOpen={openPanel === 'notation'}
                onClick={() => {
                  setActiveToolGroup('notation')
                  setOpenPanel(null)
                }}
                onChevronClick={(e) => openPanelAt('notation', e)}
              />
              <RailButton
                icon={Guitar}
                label="Chord diagrams"
                active={showChordDiagrams}
                withChevron
                panelOpen={openPanel === 'chords'}
                onClick={() => {
                  toggleChordDiagrams()
                  setOpenPanel(null)
                }}
                onChevronClick={(e) => openPanelAt('chords', e)}
              />
              <RailButton
                icon={ZoomIn}
                label="Zoom"
                active={openPanel === 'view'}
                withChevron
                panelOpen={openPanel === 'view'}
                onClick={() => setOpenPanel(null)}
                onChevronClick={(e) => openPanelAt('view', e)}
              />
            </>
          )}

          <ToolDivider />

          <div className="flex items-center rounded-[22px] bg-surface-2 p-1">
            <MiniSegmentButton label="Play mode" active={editorMode === 'transform'} onClick={() => {
              setEditorMode('transform')
              setOpenPanel(null)
            }}>
              <Music2 className="size-4" />
              <span className="ml-1 text-[11px]">Play</span>
            </MiniSegmentButton>
            <MiniSegmentButton label="Edit mode" active={editorMode === 'fineEdit'} onClick={() => {
              setEditorMode('fineEdit')
              setOpenPanel(null)
            }}>
              <MousePointer2 className="size-4" />
              <span className="ml-1 text-[11px]">Edit</span>
            </MiniSegmentButton>
          </div>
        </div>
      </div>

      <PlaybackStylePickerDrawer
        open={stylePickerOpen}
        onClose={() => setStylePickerOpen(false)}
        options={PLAYBACK_STYLE_OPTIONS}
        selectedPlaybackStyleId={playbackStyleId}
        onSelectPlaybackStyle={setPlaybackStyleId}
      />
    </>
  )
}
