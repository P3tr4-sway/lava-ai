import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
  ChevronDown,
  Grid2x2,
  Link2,
  Music2,
  MousePointer2,
  Pause,
  Play,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { NoteValue, TechniqueSet } from '@lava/shared'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'
import { PlaybackStylePickerDrawer, type PlaybackStyleOption } from '@/components/score'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore, type SelectionScope } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

interface EditorToolbarProps {
  onAddBar: () => void
  onDeleteBars: () => void
  onStylePicker: () => void
  onCompare: () => void
  totalBars?: number
  beatsPerBar?: number
  className?: string
}

type ToolbarPanel = 'playback' | 'selection' | 'note' | 'notation' | 'structure' | 'view' | null

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

const SELECTION_SCOPE_OPTIONS: Array<{ value: SelectionScope; label: string; icon?: ComponentType<{ className?: string }> }> = [
  { value: 'note', label: 'Note', icon: MousePointer2 },
  { value: 'bar', label: 'Bar', icon: Grid2x2 },
  { value: 'section', label: 'Section' },
  { value: 'range', label: 'Range' },
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
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  active?: boolean
  highlighted?: boolean
  withChevron?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-14 items-center gap-2 rounded-2xl px-4 text-text-primary transition-all',
        highlighted
          ? 'bg-accent text-surface-0 shadow-lg'
          : active
            ? 'bg-surface-2'
            : 'hover:bg-surface-1',
      )}
    >
      <Icon className="size-6" />
      {withChevron && <ChevronDown className={cn('size-4', highlighted ? 'text-surface-0/90' : 'text-text-muted')} />}
    </button>
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
      className={cn('h-9 rounded-xl px-3', !active && 'bg-surface-0')}
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
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-border bg-surface-0 px-3 text-sm text-text-primary outline-none transition-colors focus:border-border-hover"
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
  onAddBar,
  onDeleteBars,
  onStylePicker,
  totalBars = 16,
  beatsPerBar = 4,
  className,
}: EditorToolbarProps) {
  const [stylePickerOpen, setStylePickerOpen] = useState(false)
  const [openPanel, setOpenPanel] = useState<ToolbarPanel>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const editorMode = useEditorStore((s) => s.editorMode)
  const setEditorMode = useEditorStore((s) => s.setEditorMode)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const selectionScope = useEditorStore((s) => s.selectionScope)
  const setSelectionScope = useEditorStore((s) => s.setSelectionScope)
  const setToolMode = useEditorStore((s) => s.setToolMode)
  const setActiveToolGroup = useEditorStore((s) => s.setActiveToolGroup)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const showChordDiagrams = useEditorStore((s) => s.showChordDiagrams)
  const toggleChordDiagrams = useEditorStore((s) => s.toggleChordDiagrams)
  const chordDiagramGlobal = useEditorStore((s) => s.chordDiagramGlobal)
  const setChordDiagramGlobal = useEditorStore((s) => s.setChordDiagramGlobal)
  const entryDuration = useEditorStore((s) => s.entryDuration)
  const setEntryDuration = useEditorStore((s) => s.setEntryDuration)
  const entryMode = useEditorStore((s) => s.entryMode)
  const setEntryMode = useEditorStore((s) => s.setEntryMode)
  const caret = useEditorStore((s) => s.caret)
  const selectedBars = useEditorStore((s) => s.selectedBars)

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
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && openPanel) {
        setOpenPanel(null)
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

  const handleScopeChange = (scope: SelectionScope) => {
    setSelectionScope(scope)
    setToolMode(scope === 'range' || scope === 'section' ? 'range' : 'pointer')
    setActiveToolGroup('selection')
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

  const selectedBarStart = selectedBars.length > 0 ? Math.min(...selectedBars) : null
  const selectedBarEnd = selectedBars.length > 0 ? Math.max(...selectedBars) : null

  const panelContent = (() => {
    switch (openPanel) {
      case 'playback':
        return (
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Playback</p>
                <p className="mt-1 text-sm text-text-secondary">Style, transport and timing controls for practice mode.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-between rounded-xl bg-surface-0"
                onClick={() => {
                  onStylePicker()
                  setStylePickerOpen(true)
                }}
              >
                {selectedPlaybackStyle.label}
                <ChevronDown className="size-4 text-text-muted" />
              </Button>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-text-secondary">
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
                    '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border',
                    '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-border',
                    '[&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent',
                    '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent',
                  )}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="flex flex-col justify-end gap-2 rounded-2xl border border-border bg-surface-0 p-3">
                <p className="text-xs font-medium text-text-secondary">Metronome</p>
                <PanelButton active={metronomeEnabled} onClick={() => toggleMetronome()}>
                  {metronomeEnabled ? 'On' : 'Off'}
                </PanelButton>
              </div>
            </div>
          </div>
        )
      case 'selection':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Selection tool</p>
              <p className="mt-1 text-sm text-text-secondary">Switch between note, bar, section and range targeting.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SELECTION_SCOPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <PanelButton key={value} active={selectionScope === value} onClick={() => handleScopeChange(value)}>
                  {Icon && <span className="mr-1 inline-flex"><Icon className="size-4" /></span>}
                  {label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'note':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Notes</p>
                <p className="mt-1 text-sm text-text-secondary">Choose the active note value for direct entry or selected notes.</p>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Rests</p>
                <p className="mt-1 text-sm text-text-secondary">Swap the active entry mode to rests and keep the same duration shortcuts.</p>
              </div>
              <div className="flex flex-wrap gap-2">
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
          </div>
        )
      case 'notation':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Ties & Slurs</p>
                <p className="mt-1 text-sm text-text-secondary">Connect notes with ties or slurs.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PanelButton active={Boolean(primarySelectedNote?.tieStart)} onClick={toggleTie}>
                  Tie
                </PanelButton>
                <PanelButton active={Boolean(primarySelectedNote?.slurStart)} onClick={toggleSlur}>
                  Slur
                </PanelButton>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Articulations</p>
                <p className="mt-1 text-sm text-text-secondary">Apply accents and articulation marks to selected notes.</p>
              </div>
              <div className="flex flex-wrap gap-2">
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
          </div>
        )
      case 'structure':
        return (
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Structure</p>
                <p className="mt-1 text-sm text-text-secondary">Insert bars, remove selected bars, and toggle chord diagrams for the active region.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PanelButton
                  active={false}
                  onClick={() => {
                    setActiveToolGroup('measure')
                    onAddBar()
                  }}
                >
                  Add bar
                </PanelButton>
                <PanelButton
                  active={false}
                  onClick={() => {
                    setActiveToolGroup('measure')
                    onDeleteBars()
                  }}
                >
                  Delete bar
                </PanelButton>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-muted">Chord diagrams</p>
                  <div className="flex gap-2">
                    <PanelButton active={chordDiagramGlobal === 'hidden'} onClick={() => { setChordDiagramGlobal('hidden'); if (showChordDiagrams) toggleChordDiagrams() }}>
                      Off
                    </PanelButton>
                    <PanelButton active={chordDiagramGlobal === 'top'} onClick={() => { setChordDiagramGlobal('top'); if (!showChordDiagrams) toggleChordDiagrams() }}>
                      Top
                    </PanelButton>
                    <PanelButton active={chordDiagramGlobal === 'bottom'} onClick={() => { setChordDiagramGlobal('bottom'); if (!showChordDiagrams) toggleChordDiagrams() }}>
                      Bottom
                    </PanelButton>
                    <PanelButton active={chordDiagramGlobal === 'both'} onClick={() => { setChordDiagramGlobal('both'); if (!showChordDiagrams) toggleChordDiagrams() }}>
                      Both
                    </PanelButton>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-w-[150px] flex-col justify-end rounded-2xl border border-border bg-surface-0 p-3">
              <p className="text-xs font-medium text-text-secondary">Selection</p>
              <p className="mt-1 text-sm text-text-secondary">
                {selectedBarStart !== null && selectedBarEnd !== null
                  ? selectedBarStart === selectedBarEnd
                    ? `Bar ${selectedBarStart + 1}`
                    : `Bars ${selectedBarStart + 1}-${selectedBarEnd + 1}`
                  : caret
                    ? `Caret at bar ${caret.measureIndex + 1}`
                    : 'No bars selected'}
              </p>
            </div>
          </div>
        )
      case 'view':
        return (
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">View</p>
                <p className="mt-1 text-sm text-text-secondary">Canvas zoom and alternate score views.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PanelButton active={false} onClick={() => setZoom(zoom - 10)}>
                  <ZoomOut className="size-4" />
                  Zoom out
                </PanelButton>
                <PanelButton active={false} onClick={() => setZoom(zoom + 10)}>
                  <ZoomIn className="size-4" />
                  Zoom in
                </PanelButton>
                <PanelButton active={viewMode === 'tab'} onClick={() => setViewMode('tab')}>
                  Tab view
                </PanelButton>
                <PanelButton active={viewMode === 'split'} onClick={() => setViewMode('split')}>
                  Split view
                </PanelButton>
              </div>
            </div>
            <div className="flex min-w-[120px] flex-col justify-end rounded-2xl border border-border bg-surface-0 p-3">
              <p className="text-xs font-medium text-text-secondary">Zoom</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">{zoom}%</p>
            </div>
          </div>
        )
      default:
        return null
    }
  })()

  return (
    <>
      <div ref={toolbarRef} className={cn('pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2', className)}>
        {panelContent && (
          <div className="pointer-events-auto absolute bottom-full left-1/2 mb-3 w-[min(92vw,720px)] -translate-x-1/2 rounded-[28px] border border-border bg-surface-0/96 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur">
            {panelContent}
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

          <RailButton
            icon={MousePointer2}
            label="Selection tools"
            active={openPanel === 'selection'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'selection' ? null : 'selection')}
          />

          <RailButton
            icon={Music2}
            label="Playback options"
            active={openPanel === 'playback'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'playback' ? null : 'playback')}
          />

          <RailButton
            icon={Square}
            label="Note and rest durations"
            active={openPanel === 'note'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'note' ? null : 'note')}
          />
          <RailButton
            icon={Link2}
            label="Notation tools"
            active={openPanel === 'notation'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'notation' ? null : 'notation')}
          />
          <RailButton
            icon={Grid2x2}
            label="Measure and chord tools"
            active={openPanel === 'structure'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'structure' ? null : 'structure')}
          />

          <RailButton
            icon={ZoomIn}
            label="View controls"
            active={openPanel === 'view'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'view' ? null : 'view')}
          />

          <ToolDivider />

          <div className="flex items-center rounded-[22px] bg-surface-2 p-1">
            <MiniSegmentButton label="Play mode" active={editorMode === 'transform' && viewMode !== 'split'} onClick={() => {
              setEditorMode('transform')
              if (viewMode === 'split') setViewMode('tab')
            }}>
              <Music2 className="size-4" />
              <span className="ml-1 text-[11px]">Play</span>
            </MiniSegmentButton>
            <MiniSegmentButton label="Edit mode" active={editorMode === 'fineEdit' && viewMode !== 'split'} onClick={() => {
              setEditorMode('fineEdit')
              if (viewMode === 'split') setViewMode('tab')
            }}>
              <MousePointer2 className="size-4" />
              <span className="ml-1 text-[11px]">Edit</span>
            </MiniSegmentButton>
            <MiniSegmentButton label="Split view" active={viewMode === 'split'} onClick={() => setViewMode(viewMode === 'split' ? 'tab' : 'split')}>
              <Grid2x2 className="size-4" />
              <span className="ml-1 text-[11px]">Split</span>
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
