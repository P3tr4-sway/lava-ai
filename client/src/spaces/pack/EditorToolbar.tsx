import { useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  AudioLines,
  ChevronDown,
  Circle,
  Clock3,
  Columns2,
  Hash,
  KeyRound,
  MousePointer2,
  Music,
  Music2,
  Pause,
  PencilLine,
  PenTool,
  Play,
  Repeat2,
  SlidersHorizontal,
  SlidersVertical,
  Spline,
  Timer,
  Type,
  WholeWord,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { NoteValue, Technique } from '@lava/shared'
import { TECHNIQUE_DEFS } from '@/spaces/pack/editor-core/techniqueDefinitions'
import { TechniquePanel } from '@/components/ui/TechniquePanel'
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
  | 'accidentals'
  | 'dynamics'
  | 'keySig'
  | 'timeSig'
  | 'repeats'
  | 'barlines'
  | 'clefs'
  | 'tempo'
  | 'pitch'
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
  return <div className="h-[30px] w-px bg-border" />
}

function ToolbarToolButton({
  icon: Icon,
  label,
  selected,
  withChevron = false,
  panelOpen,
  badge,
  onClick,
  onChevronClick,
  onHoverOpen,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  selected?: boolean
  withChevron?: boolean
  panelOpen?: boolean
  badge?: string
  onClick: () => void
  onChevronClick?: (e: ReactMouseEvent) => void
  onHoverOpen?: (e: ReactMouseEvent) => void
}) {
  return (
    <div
      data-rail-button
      onMouseEnter={(e) => onHoverOpen?.(e)}
      className={cn(
        'flex h-full w-10 shrink-0 items-center rounded transition-colors',
        selected ? 'bg-[#8df790]' : 'text-[#0d0d0d] hover:bg-[#f6f6f6]',
      )}
    >
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={onClick}
        className="flex h-full flex-1 items-center justify-center rounded"
      >
        <span className="flex size-[30px] items-center justify-center rounded">
          <Icon className="size-[18px] stroke-[2]" />
        </span>
      </button>
      {withChevron && (
        <button
          type="button"
          aria-label={`${label} options`}
          onClick={(e) => {
            e.stopPropagation()
            onChevronClick?.(e)
          }}
          className="flex h-full w-[10px] items-center justify-center rounded-r text-[#0d0d0d]"
        >
          <ChevronDown className={cn('size-3 transition-transform', panelOpen && 'rotate-180')} />
        </button>
      )}
    </div>
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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 rounded-lg border px-2.5 text-xs transition-colors',
        active
          ? 'border-[#8df790] bg-[#8df790] text-[#0d0d0d]'
          : 'border-border bg-surface-0 text-text-primary hover:bg-surface-1',
      )}
    >
      {children}
    </button>
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

function ToolbarModeSwitch({
  editMode,
  onToggle,
}: {
  editMode: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={editMode ? 'Switch to play mode' : 'Switch to edit mode'}
      title={editMode ? 'Edit mode' : 'Play mode'}
      className={cn(
        'relative h-[23px] w-[39px] rounded bg-[#efefef] transition-colors',
        editMode && 'bg-[#8df790]',
      )}
    >
      <span
        className={cn(
          'absolute top-0 flex size-[23px] items-center justify-center rounded-[4px] border border-[#474747] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.25),0_2px_2px_rgba(0,0,0,0.25)] transition-all',
          editMode ? 'left-[16px]' : 'left-0',
        )}
      >
        {editMode ? <PencilLine className="size-4 text-[#0d0d0d]" /> : <Play className="ml-px size-4 fill-current text-[#0d0d0d]" />}
      </span>
    </button>
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
  const [activeSidebarTool, setActiveSidebarTool] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const toolbarRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const toggleSidebarTool = (id: string) => {
    setActiveSidebarTool((prev) => (prev === id ? null : id))
    setOpenPanel(null)
  }

  const openPanelAt = (panel: ToolbarPanel, event: ReactMouseEvent) => {
    const buttonEl = (event.currentTarget as HTMLElement).closest('[data-rail-button]') as HTMLElement | null
    openPanelFromButton(panel, buttonEl)
  }

  const openPanelFromButton = (panel: ToolbarPanel, buttonEl: HTMLElement | null) => {
    const toolbarEl = toolbarRef.current
    if (!toolbarEl || !buttonEl) {
      setOpenPanel((p) => p === panel ? null : panel)
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
  const toolMode = useEditorStore((s) => s.toolMode)
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

  const docKeySig = `${document.keySignature.key} ${document.keySignature.mode}`
  const docTimeSig = `${document.meter.numerator}/${document.meter.denominator}`
  const docClef = track?.clef ? (track.clef.charAt(0).toUpperCase() + track.clef.slice(1)) : 'Treble'

  const selectedBarIndex = useEditorStore((s) =>
    s.selectedBars.length > 0 ? Math.min(...s.selectedBars) : s.caret?.measureIndex ?? null,
  )
  const selectedMeasureMeta = selectedBarIndex !== null ? (document.measures[selectedBarIndex] ?? null) : null

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

  useEffect(() => {
    if (editorMode !== 'fineEdit') {
      setActiveSidebarTool(null)
      setSelectedOptions({})
      setOpenPanel(null)
      setPanelAnchor(null)
    }
  }, [editorMode])

  const closeOpenPanel = () => {
    setOpenPanel(null)
    setPanelAnchor(null)
  }

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
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Techniques</p>
            {Object.entries(
              TECHNIQUE_DEFS.reduce<Record<string, typeof TECHNIQUE_DEFS>>((acc, def) => {
                const g = acc[def.group] ?? []
                g.push(def)
                acc[def.group] = g
                return acc
              }, {})
            ).map(([group, defs]) => (
              <div key={group} className="flex flex-wrap gap-1 mb-1">
                {defs.map((def) => {
                  const active = primarySelectedNote?.techniques.find((t) => t.type === def.type)
                  return (
                    <TechniquePanel
                      key={def.type}
                      def={def}
                      activeTechnique={active}
                      onApply={(technique: Technique) => {
                        if (!primarySelectedNote) return
                        applyCommand({ type: 'addTechnique', noteId: primarySelectedNote.id, technique })
                      }}
                      onRemove={(type: string) => {
                        if (!primarySelectedNote) return
                        applyCommand({ type: 'removeTechnique', noteId: primarySelectedNote.id, techniqueType: type as Technique['type'] })
                      }}
                    />
                  )
                })}
              </div>
            ))}
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
      case 'accidentals':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Accidentals</p>
            <div className="flex flex-col gap-1">
              {[
                { value: 'sharp', label: 'Sharp' },
                { value: 'flat', label: 'Flat' },
                { value: 'natural', label: 'Natural' },
                { value: 'courtesy', label: 'Courtesy accidental' },
              ].map((opt) => (
                <PanelButton key={opt.value} active={false} onClick={() => window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: opt.value } }))}>
                  {opt.label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'dynamics':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Dynamics</p>
            <div className="flex gap-1">
              {(['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const).map((dyn) => (
                <PanelButton key={dyn} active={primarySelectedNote?.dynamic === dyn} onClick={() => window.dispatchEvent(new CustomEvent('lava-dynamic', { detail: { value: dyn } }))}>
                  {dyn}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'keySig':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Key signatures</p>
            <div className="flex flex-col gap-1">
              {['C major', 'G major', 'D major', 'F major', 'Bb major', 'A minor', 'E minor', 'D minor'].map((key) => (
                <PanelButton key={key} active={docKeySig === key} onClick={() => {
                  setActiveSidebarTool('keySig')
                  window.dispatchEvent(new CustomEvent('lava-key-sig', { detail: { value: key } }))
                  closeOpenPanel()
                }}>
                  {key}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'timeSig':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Time signatures</p>
            <div className="flex flex-wrap gap-1">
              {['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '5/4', '7/8'].map((sig) => (
                <PanelButton key={sig} active={docTimeSig === sig} onClick={() => {
                  setActiveSidebarTool('timeSig')
                  window.dispatchEvent(new CustomEvent('lava-time-sig', { detail: { value: sig } }))
                  closeOpenPanel()
                }}>
                  {sig}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'repeats':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Repeats & jumps</p>
            <div className="flex flex-col gap-1">
              {[
                { label: 'Repeat start', isActive: Boolean(selectedMeasureMeta?.isRepeatStart) },
                { label: 'Repeat end', isActive: Boolean(selectedMeasureMeta?.isRepeatEnd) },
                { label: 'D.C. al Fine', isActive: selectedMeasureMeta?.repeatMarker === 'dc-al-fine' },
                { label: 'D.S. al Coda', isActive: selectedMeasureMeta?.repeatMarker === 'ds-al-coda' },
                { label: 'Segno', isActive: selectedMeasureMeta?.repeatMarker === 'segno' },
                { label: 'Fine', isActive: selectedMeasureMeta?.repeatMarker === 'fine' },
                { label: 'Coda', isActive: selectedMeasureMeta?.repeatMarker === 'coda' },
              ].map(({ label, isActive }) => (
                <PanelButton key={label} active={isActive} onClick={() => {
                  setActiveSidebarTool('repeats')
                  window.dispatchEvent(new CustomEvent('lava-repeat', { detail: { value: label } }))
                  closeOpenPanel()
                }}>
                  {label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'barlines':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Barlines</p>
            <div className="flex flex-col gap-1">
              {(['Single', 'Double', 'Final', 'Dashed', 'Dotted'] as const).map((opt) => {
                const barlineValue = opt.toLowerCase() as 'single' | 'double' | 'final' | 'dashed' | 'dotted'
                const isActive = barlineValue === 'single'
                  ? !selectedMeasureMeta?.barlineType || selectedMeasureMeta.barlineType === 'single'
                  : selectedMeasureMeta?.barlineType === barlineValue
                return (
                  <PanelButton key={opt} active={isActive} onClick={() => {
                    setActiveSidebarTool('barlines')
                    window.dispatchEvent(new CustomEvent('lava-barline', { detail: { value: opt } }))
                    closeOpenPanel()
                  }}>
                    {opt}
                  </PanelButton>
                )
              })}
            </div>
          </div>
        )
      case 'clefs':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Clefs</p>
            <div className="flex flex-col gap-1">
              {['Treble', 'Bass', 'Alto', 'Tenor'].map((opt) => (
                <PanelButton key={opt} active={docClef === opt} onClick={() => {
                  setActiveSidebarTool('clefs')
                  window.dispatchEvent(new CustomEvent('lava-clef', { detail: { value: opt } }))
                  closeOpenPanel()
                }}>
                  {opt}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'tempo':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Tempo</p>
            <div className="flex flex-col gap-1">
              {[
                { label: 'Largo', range: [40, 60], bpm: 50 },
                { label: 'Andante', range: [76, 108], bpm: 92 },
                { label: 'Moderato', range: [108, 120], bpm: 114 },
                { label: 'Allegro', range: [120, 168], bpm: 144 },
                { label: 'Presto', range: [168, 200], bpm: 184 },
              ].map((opt) => (
                <PanelButton key={opt.label} active={document.tempo >= opt.range[0] && document.tempo <= opt.range[1]} onClick={() => {
                  setActiveSidebarTool('tempo')
                  window.dispatchEvent(new CustomEvent('lava-tempo', { detail: { value: opt.label } }))
                  closeOpenPanel()
                }}>
                  {opt.label} <span className="text-text-muted">{opt.range[0]}–{opt.range[1]}</span>
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'pitch':
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Pitch</p>
            <div className="flex flex-col gap-1">
              {['Octave up', 'Octave down'].map((opt) => (
                <PanelButton key={opt} active={false} onClick={() => {
                  window.dispatchEvent(new CustomEvent('lava-pitch-mode', { detail: { value: opt } }))
                  closeOpenPanel()
                }}>
                  {opt}
                </PanelButton>
              ))}
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
      <div
        ref={toolbarRef}
        onMouseLeave={() => closeOpenPanel()}
        className={cn('pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2', className)}
      >
        {activePanelContent && (
          <div
            ref={panelRef}
            className="pointer-events-auto absolute bottom-full mb-3 w-auto min-w-[180px] max-w-[min(92vw,380px)] rounded-2xl border border-border bg-surface-0 p-3 shadow-sm"
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

        <div className="pointer-events-auto overflow-hidden rounded-[12px] border border-border bg-surface-0 shadow-sm">
          {editorMode === 'transform' ? (
            /* ── Transform (playback) mode — single row, unchanged ── */
            <div className="flex h-[46px] items-center gap-[5px] p-2">
              <ToolbarToolButton
                icon={isPlaying ? Pause : Play}
                label={isPlaying ? 'Pause playback' : 'Play score'}
                selected={isPlaying}
                onClick={handleTogglePlayback}
              />
              <ToolbarToolButton
                icon={Music2}
                label="Playback style"
                onClick={() => setStylePickerOpen(true)}
              />
              <ToolbarToolButton
                icon={SlidersHorizontal}
                label="Playback settings"
                selected={openPanel === 'playbackSettings'}
                withChevron
                panelOpen={openPanel === 'playbackSettings'}
                onClick={() => setOpenPanel((p) => p === 'playbackSettings' ? null : 'playbackSettings')}
                onHoverOpen={(e) => openPanelAt('playbackSettings', e)}
                onChevronClick={(e) => openPanelAt('playbackSettings', e)}
              />
              <ToolbarToolButton
                icon={Timer}
                label={metronomeEnabled ? 'Metronome on' : 'Metronome off'}
                selected={metronomeEnabled}
                onClick={() => toggleMetronome()}
              />
              <ToolDivider />
              <div className="flex h-[39px] items-center px-1">
                <ToolbarModeSwitch
                  editMode={false}
                  onToggle={() => {
                    setEditorMode('fineEdit')
                    closeOpenPanel()
                  }}
                />
              </div>
            </div>
          ) : (
            /* ── fineEdit mode — two rows + spanning toggle ── */
            <div className="flex">
              {/* Left: two rows */}
              <div className="flex flex-col">
                {/* Row 1 — primary tools (1–0) */}
                <div className="flex h-[46px] items-center gap-[3px] px-2 py-1">
                  <ToolbarToolButton
                    icon={MousePointer2}
                    label="Selection"
                    selected={activeToolGroup === 'selection'}
                    onClick={() => {
                      setActiveToolGroup('selection')
                      setToolMode('pointer')
                      setCaret(null)
                      setOpenPanel(null)
                    }}
                  />
                  <ToolbarToolButton
                    icon={Music}
                    label="Notes & rests"
                    selected={activeToolGroup === 'note' || activeToolGroup === 'rest'}
                    withChevron
                    panelOpen={openPanel === 'note'}
                    onClick={() => {
                      setActiveToolGroup('note')
                      setOpenPanel(null)
                    }}
                    onHoverOpen={(e) => openPanelAt('note', e)}
                    onChevronClick={(e) => openPanelAt('note', e)}
                  />
                  <ToolbarToolButton
                    icon={Hash}
                    label="Accidentals"
                    selected={openPanel === 'accidentals'}
                    withChevron
                    panelOpen={openPanel === 'accidentals'}
                    onClick={() => setOpenPanel((p) => p === 'accidentals' ? null : 'accidentals')}
                    onHoverOpen={(e) => openPanelAt('accidentals', e)}
                    onChevronClick={(e) => openPanelAt('accidentals', e)}
                  />
                  <ToolbarToolButton
                    icon={Spline}
                    label="Ties, slurs & articulations"
                    selected={activeToolGroup === 'notation'}
                    withChevron
                    panelOpen={openPanel === 'notation'}
                    onClick={() => {
                      setActiveToolGroup('notation')
                      setOpenPanel(null)
                    }}
                    onHoverOpen={(e) => openPanelAt('notation', e)}
                    onChevronClick={(e) => openPanelAt('notation', e)}
                  />
                  <ToolbarToolButton
                    icon={WholeWord}
                    label="Dynamics"
                    selected={openPanel === 'dynamics'}
                    withChevron
                    panelOpen={openPanel === 'dynamics'}
                    onClick={() => setOpenPanel((p) => p === 'dynamics' ? null : 'dynamics')}
                    onHoverOpen={(e) => openPanelAt('dynamics', e)}
                    onChevronClick={(e) => openPanelAt('dynamics', e)}
                  />
                  <ToolbarToolButton
                    icon={Type}
                    label="Text"
                    selected={toolMode === 'text'}
                    onClick={() => {
                      setToolMode('text')
                      setOpenPanel(null)
                    }}
                  />
                  <ToolbarToolButton
                    icon={KeyRound}
                    label="Key signatures"
                    selected={activeSidebarTool === 'keySig'}
                    withChevron
                    panelOpen={openPanel === 'keySig'}
                    onClick={() => {
                      toggleSidebarTool('keySig')
                      setToolMode('keySig')
                    }}
                    onHoverOpen={(e) => openPanelAt('keySig', e)}
                    onChevronClick={(e) => openPanelAt('keySig', e)}
                  />
                  <ToolbarToolButton
                    icon={Clock3}
                    label="Time signatures"
                    selected={activeSidebarTool === 'timeSig'}
                    withChevron
                    panelOpen={openPanel === 'timeSig'}
                    onClick={() => toggleSidebarTool('timeSig')}
                    onHoverOpen={(e) => openPanelAt('timeSig', e)}
                    onChevronClick={(e) => openPanelAt('timeSig', e)}
                  />
                  <ToolbarToolButton
                    icon={Repeat2}
                    label="Repeats & jumps"
                    selected={activeSidebarTool === 'repeats'}
                    withChevron
                    panelOpen={openPanel === 'repeats'}
                    onClick={() => toggleSidebarTool('repeats')}
                    onHoverOpen={(e) => openPanelAt('repeats', e)}
                    onChevronClick={(e) => openPanelAt('repeats', e)}
                  />
                  <ToolbarToolButton
                    icon={Columns2}
                    label="Barlines"
                    selected={activeSidebarTool === 'barlines'}
                    withChevron
                    panelOpen={openPanel === 'barlines'}
                    onClick={() => toggleSidebarTool('barlines')}
                    onHoverOpen={(e) => openPanelAt('barlines', e)}
                    onChevronClick={(e) => openPanelAt('barlines', e)}
                  />
                </div>
                {/* Row 2 — secondary tools */}
                <div className="flex h-[46px] items-center gap-[3px] border-t border-border px-2 py-1">
                  <ToolbarToolButton
                    icon={Music2}
                    label="Clefs"
                    selected={activeSidebarTool === 'clefs'}
                    withChevron
                    panelOpen={openPanel === 'clefs'}
                    onClick={() => toggleSidebarTool('clefs')}
                    onHoverOpen={(e) => openPanelAt('clefs', e)}
                    onChevronClick={(e) => openPanelAt('clefs', e)}
                  />
                  <ToolbarToolButton
                    icon={SlidersVertical}
                    label="Tempo"
                    selected={activeSidebarTool === 'tempo'}
                    withChevron
                    panelOpen={openPanel === 'tempo'}
                    onClick={() => toggleSidebarTool('tempo')}
                    onHoverOpen={(e) => openPanelAt('tempo', e)}
                    onChevronClick={(e) => openPanelAt('tempo', e)}
                  />
                  <ToolbarToolButton
                    icon={AudioLines}
                    label="Pitch"
                    selected={activeSidebarTool === 'pitch'}
                    withChevron
                    panelOpen={openPanel === 'pitch'}
                    onClick={() => toggleSidebarTool('pitch')}
                    onHoverOpen={(e) => openPanelAt('pitch', e)}
                    onChevronClick={(e) => openPanelAt('pitch', e)}
                  />
                  <ToolbarToolButton
                    icon={PenTool}
                    label="Chord diagrams"
                    selected={showChordDiagrams}
                    withChevron
                    panelOpen={openPanel === 'chords'}
                    onClick={() => {
                      toggleChordDiagrams()
                      setOpenPanel(null)
                    }}
                    onHoverOpen={(e) => openPanelAt('chords', e)}
                    onChevronClick={(e) => openPanelAt('chords', e)}
                  />
                  <ToolbarToolButton
                    icon={ZoomIn}
                    label="Zoom"
                    selected={openPanel === 'view'}
                    onClick={() => setOpenPanel((p) => p === 'view' ? null : 'view')}
                    onHoverOpen={(e) => openPanelAt('view', e)}
                  />
                  <ToolbarToolButton
                    icon={Circle}
                    label="Playback style"
                    onClick={() => setStylePickerOpen(true)}
                  />
                </div>
              </div>
              {/* Right: mode toggle spanning both rows */}
              <div className="flex items-center justify-center border-l border-border px-3">
                <ToolbarModeSwitch
                  editMode={true}
                  onToggle={() => {
                    setEditorMode('transform')
                    setActiveSidebarTool(null)
                    closeOpenPanel()
                  }}
                />
              </div>
            </div>
          )}
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
