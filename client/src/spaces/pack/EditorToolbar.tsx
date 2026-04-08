import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Circle,
  ChevronDown,
  Play,
  SkipBack,
  Spline,
  Square,
  Type,
  ZoomIn,
} from 'lucide-react'
import type { BarlineType, Dynamic, NoteValue, RepeatMarker } from '@lava/shared'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

interface EditorToolbarProps {
  totalBars?: number
  beatsPerBar?: number
  className?: string
}

type ToolbarPanel = 'note' | 'bar' | 'effect' | 'view' | null
type PanelAnchor = { left: number } | null

const DURATION_OPTIONS: Array<{ value: NoteValue; label: string; noteGlyph: string; restGlyph: string }> = [
  { value: 'whole', label: 'Whole', noteGlyph: String.fromCodePoint(0xECA2), restGlyph: String.fromCodePoint(0xE4E3) },
  { value: 'half', label: 'Half', noteGlyph: String.fromCodePoint(0xECA3), restGlyph: String.fromCodePoint(0xE4E4) },
  { value: 'quarter', label: 'Quarter', noteGlyph: String.fromCodePoint(0xECA5), restGlyph: String.fromCodePoint(0xE4E5) },
  { value: 'eighth', label: 'Eighth', noteGlyph: String.fromCodePoint(0xECA7), restGlyph: String.fromCodePoint(0xE4E6) },
  { value: 'sixteenth', label: 'Sixteenth', noteGlyph: String.fromCodePoint(0xECA9), restGlyph: String.fromCodePoint(0xE4E7) },
]

const ACCIDENTAL_OPTIONS = [
  { type: 'sharp' as const, label: 'Sharp', glyph: String.fromCodePoint(0xE262) },
  { type: 'flat' as const, label: 'Flat', glyph: String.fromCodePoint(0xE260) },
  { type: 'natural' as const, label: 'Natural', glyph: String.fromCodePoint(0xE261) },
]

const BARLINE_OPTIONS: Array<{ label: string; value: BarlineType }> = [
  { label: 'Single', value: 'single' },
  { label: 'Double', value: 'double' },
  { label: 'Final', value: 'final' },
]
const REPEAT_MARKER_OPTIONS: Array<{ label: string; value: RepeatMarker }> = [
  { label: 'Segno', value: 'segno' },
  { label: 'Fine', value: 'fine' },
  { label: 'Coda', value: 'coda' },
]
const DYNAMIC_OPTIONS: Dynamic[] = ['pp', 'p', 'mp', 'mf', 'f', 'ff']
const BAR_GROUP_GLYPH = String.fromCodePoint(0xE033)
const NOTE_GROUP_GLYPH = String.fromCodePoint(0xECA5)
const EFFECT_GROUP_GLYPH = String.fromCodePoint(0xE52D)

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

function NotationGlyph({ glyph, className }: { glyph: string; className?: string }) {
  return (
    <span
      className={cn('lava-smufl inline-flex h-5 items-center justify-center leading-none', className)}
      aria-hidden="true"
    >
      {glyph}
    </span>
  )
}

function PanelSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">{title}</p>
      {children}
    </div>
  )
}

function PanelButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex min-h-[36px] items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        active
          ? 'border-accent bg-accent text-surface-0'
          : 'border-border bg-surface-0 text-text-primary hover:bg-surface-1 hover:border-border-hover',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-surface-0 hover:border-border',
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
        className="h-9 rounded-xl border border-border bg-surface-0 px-3 text-sm text-text-primary outline-none transition-colors focus:border-border-hover"
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

function ToolbarGroupButton({
  icon,
  label,
  selected,
  onClick,
  onMouseEnter,
  withChevron = true,
}: {
  icon: ReactNode
  label: string
  selected?: boolean
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
  onMouseEnter?: (event: ReactMouseEvent<HTMLButtonElement>) => void
  withChevron?: boolean
}) {
  return (
    <button
      type="button"
      data-toolbar-group
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        selected
          ? 'bg-surface-1 text-text-primary'
          : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary',
      )}
    >
      <span className="flex size-5 items-center justify-center">{icon}</span>
      <span>{label}</span>
      {withChevron ? <ChevronDown className={cn('size-3.5 transition-transform', selected && 'rotate-180')} /> : null}
    </button>
  )
}

function TransportButton({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: ReactNode
  label: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        selected
          ? 'bg-surface-1 text-text-primary'
          : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary',
      )}
    >
      {icon}
    </button>
  )
}

export function EditorToolbar({
  totalBars = 16,
  beatsPerBar = 4,
  className,
}: EditorToolbarProps) {
  const [openPanel, setOpenPanel] = useState<ToolbarPanel>(null)
  const [panelAnchor, setPanelAnchor] = useState<PanelAnchor>(null)
  const [addBarsCount, setAddBarsCount] = useState('4')
  const toolbarRef = useRef<HTMLDivElement>(null)

  const setToolMode = useEditorStore((state) => state.setToolMode)
  const activeToolGroup = useEditorStore((state) => state.activeToolGroup)
  const setActiveToolGroup = useEditorStore((state) => state.setActiveToolGroup)
  const showChordDiagrams = useEditorStore((state) => state.showChordDiagrams)
  const toggleChordDiagrams = useEditorStore((state) => state.toggleChordDiagrams)
  const chordDiagramGlobal = useEditorStore((state) => state.chordDiagramGlobal)
  const setChordDiagramGlobal = useEditorStore((state) => state.setChordDiagramGlobal)
  const viewMode = useEditorStore((state) => state.viewMode)
  const setViewMode = useEditorStore((state) => state.setViewMode)
  const entryDuration = useEditorStore((state) => state.entryDuration)
  const setEntryDuration = useEditorStore((state) => state.setEntryDuration)
  const entryMode = useEditorStore((state) => state.entryMode)
  const setEntryMode = useEditorStore((state) => state.setEntryMode)
  const setCaret = useEditorStore((state) => state.setCaret)
  const selectBar = useEditorStore((state) => state.selectBar)
  const selectedBars = useEditorStore((state) => state.selectedBars)
  const selectedNoteIds = useEditorStore((state) => state.selectedNoteIds)
  const caret = useEditorStore((state) => state.caret)

  const document = useScoreDocumentStore((state) => state.document)
  const applyCommand = useScoreDocumentStore((state) => state.applyCommand)
  const track = document.tracks[0]

  const transportState = useAudioStore((state) => state.transportState)
  const setTransportState = useAudioStore((state) => state.setTransportState)
  const currentBar = useAudioStore((state) => state.currentBar)
  const setCurrentBar = useAudioStore((state) => state.setCurrentBar)
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime)

  const safeTotalBars = Math.max(1, totalBars)
  const isPlaying = isRunningState(transportState)
  const clampedBar = Math.max(0, Math.min(currentBar, safeTotalBars))

  const selectedNotes = useMemo(
    () => selectedNoteIds.map((noteId) => track?.notes.find((note) => note.id === noteId)).filter(Boolean),
    [selectedNoteIds, track?.notes],
  )
  const primarySelectedNote = selectedNotes[0] ?? null
  const selectedMeasureIndex = selectedBars.length > 0
    ? Math.max(...selectedBars)
    : caret?.measureIndex ?? null
  const selectedMeasureMeta = selectedMeasureIndex !== null ? document.measures[selectedMeasureIndex] ?? null : null
  const hasMeasureContext = selectedMeasureIndex !== null
  const hasSelectedNotes = selectedNoteIds.length > 0
  const canTranspose = hasSelectedNotes || selectedBars.length > 0
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setOpenPanel(null)
        setPanelAnchor(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [])

  const openPanelFromButton = (panel: ToolbarPanel, buttonEl: HTMLElement | null) => {
    const toolbarEl = toolbarRef.current
    if (!toolbarEl || !buttonEl) {
      setOpenPanel((current) => current === panel ? null : panel)
      return
    }
    const toolbarRect = toolbarEl.getBoundingClientRect()
    const buttonRect = buttonEl.getBoundingClientRect()
    setPanelAnchor({ left: buttonRect.left - toolbarRect.left + buttonRect.width / 2 })
    setOpenPanel((current) => current === panel ? null : panel)
  }

  const handleOpenPanel = (panel: ToolbarPanel, event: ReactMouseEvent<HTMLButtonElement>) => {
    const buttonEl = event.currentTarget.closest('[data-toolbar-group]') as HTMLElement | null
    openPanelFromButton(panel, buttonEl)
  }

  const handleHoverOpenPanel = (panel: ToolbarPanel, event: ReactMouseEvent<HTMLButtonElement>) => {
    const buttonEl = event.currentTarget.closest('[data-toolbar-group]') as HTMLElement | null
    const toolbarEl = toolbarRef.current
    if (!toolbarEl || !buttonEl) return
    const toolbarRect = toolbarEl.getBoundingClientRect()
    const buttonRect = buttonEl.getBoundingClientRect()
    setPanelAnchor({ left: buttonRect.left - toolbarRect.left + buttonRect.width / 2 })
    setOpenPanel(panel)
  }

  const closeOpenPanel = () => {
    setOpenPanel(null)
    setPanelAnchor(null)
  }

  const activateSelection = () => {
    setActiveToolGroup('selection')
    setToolMode('pointer')
    setCaret(null)
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

  const handleStopPlayback = () => {
    setTransportState('stopped')
    setCurrentBar(0)
    setCurrentTime(0)
  }

  const handleBackToBeginning = () => {
    setCurrentBar(0)
    setCurrentTime(0)
    if (isPlaying) {
      setTransportState('locating')
      window.setTimeout(() => setTransportState('rolling'), 0)
    }
  }

  const setEntryTool = (mode: 'note' | 'rest', duration?: NoteValue) => {
    setEntryMode(mode)
    setEntryDuration(duration ?? entryDuration)
    setActiveToolGroup(mode === 'rest' ? 'rest' : 'note')
  }

  const applyDurationToSelection = (duration: NoteValue, restMode: boolean) => {
    setEntryTool(restMode ? 'rest' : 'note', duration)
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

  const applyAccidental = (type: 'sharp' | 'flat' | 'natural') => {
    if (!track || selectedNoteIds.length === 0) return
    selectedNoteIds.forEach((noteId) => {
      const note = track.notes.find((entry) => entry.id === noteId)
      if (!note?.pitch) return
      const nextPitch = { ...note.pitch }
      if (type === 'sharp') nextPitch.alter = 1
      else if (type === 'flat') nextPitch.alter = -1
      else delete nextPitch.alter
      applyCommand({ type: 'setPitch', trackId: track.id, noteId, pitch: nextPitch })
    })
  }

  const toggleTie = () => {
    if (!track || selectedNoteIds.length === 0) return
    selectedNoteIds.forEach((noteId) => applyCommand({ type: 'toggleTie', trackId: track.id, noteId }))
  }

  const toggleSlur = () => {
    if (!track || selectedNoteIds.length === 0) return
    selectedNoteIds.forEach((noteId) => applyCommand({ type: 'toggleSlur', trackId: track.id, noteId }))
  }

  const toggleDot = () => {
    if (!selectedNoteIds.length) return
    selectedNoteIds.forEach((noteId) => applyCommand({ type: 'toggleDot', noteId }))
  }

  const toggleTriplet = () => {
    if (!selectedNoteIds.length) return
    selectedNoteIds.forEach((noteId) => applyCommand({ type: 'toggleTuplet', noteId, actual: 3, normal: 2 }))
  }

  const transposeSelection = (semitones: number) => {
    if (!track || !canTranspose) return
    applyCommand({
      type: 'transposeSelection',
      trackId: track.id,
      noteIds: selectedNoteIds.length > 0 ? selectedNoteIds : undefined,
      measureRange: selectedBars.length > 0 ? [Math.min(...selectedBars), Math.max(...selectedBars)] : null,
      semitones,
    })
  }

  const addBars = (count: number) => {
    const safeCount = Math.max(1, Math.min(64, Math.floor(count)))
    const afterIndex = selectedMeasureIndex ?? Math.max(document.measures.length - 1, 0)
    applyCommand({ type: 'addMeasureAfter', afterIndex, count: safeCount })
    selectBar(afterIndex + 1)
    setAddBarsCount(String(safeCount))
    closeOpenPanel()
  }

  const applyBarline = (barlineType: BarlineType) => {
    if (!hasMeasureContext) return
    const indices = selectedBars.length > 0 ? selectedBars : [selectedMeasureIndex!]
    indices.forEach((measureIndex) => {
      applyCommand({ type: 'setBarlineType', measureIndex, barlineType })
    })
  }

  const setRepeatEnabled = (repeatType: 'start' | 'end') => {
    if (!hasMeasureContext) return
    const indices = selectedBars.length > 0 ? selectedBars : [selectedMeasureIndex!]
    indices.forEach((measureIndex) => {
      applyCommand({ type: 'setRepeat', measureIndex, repeatType, enabled: true })
    })
  }

  const applyRepeatMarker = (marker: RepeatMarker) => {
    if (!hasMeasureContext) return
    const indices = selectedBars.length > 0 ? selectedBars : [selectedMeasureIndex!]
    indices.forEach((measureIndex) => {
      applyCommand({ type: 'setRepeatMarker', measureIndex, marker })
    })
  }

  const applyDynamic = (dynamic: Dynamic) => {
    if (!track || selectedNoteIds.length === 0) return
    selectedNoteIds.forEach((noteId) => {
      applyCommand({ type: 'setNoteDynamic', trackId: track.id, noteId, dynamic })
    })
  }

  const panelContent = (() => {
    switch (openPanel) {
      case 'note':
        return (
          <div className="space-y-3">
            <PanelSection title="Entry">
              <div className="flex gap-2">
                <PanelButton title="Note" active={entryMode === 'note'} onClick={() => setEntryTool('note')}>
                  <NotationGlyph glyph={String.fromCodePoint(0xECA5)} />
                </PanelButton>
                <PanelButton title="Rest" active={entryMode === 'rest'} onClick={() => setEntryTool('rest')}>
                  <NotationGlyph glyph={String.fromCodePoint(0xE4E5)} />
                </PanelButton>
              </div>
            </PanelSection>

            <PanelSection title="Duration">
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((option) => (
                  <PanelButton
                    title={option.label}
                    key={option.value}
                    active={entryDuration === option.value}
                    onClick={() => applyDurationToSelection(option.value, entryMode === 'rest')}
                  >
                    <NotationGlyph glyph={entryMode === 'rest' ? option.restGlyph : option.noteGlyph} />
                  </PanelButton>
                ))}
              </div>
            </PanelSection>

            <PanelSection title="Accidentals">
              <div className="flex flex-wrap gap-2">
                {ACCIDENTAL_OPTIONS.map((option) => (
                  <PanelButton
                    title={option.label}
                    key={option.type}
                    disabled={!hasSelectedNotes}
                    onClick={() => applyAccidental(option.type)}
                  >
                    <NotationGlyph glyph={option.glyph} className="text-[20px]" />
                  </PanelButton>
                ))}
              </div>
            </PanelSection>
          </div>
        )
      case 'effect':
        return (
          <div className="space-y-3">
            <PanelSection title="Notation">
              <div className="flex flex-wrap gap-2">
                <PanelButton title="Tie" disabled={!hasSelectedNotes} onClick={toggleTie}>
                  <NotationGlyph glyph={String.fromCodePoint(0xE1FD)} />
                </PanelButton>
                <PanelButton title="Slur" disabled={!hasSelectedNotes} onClick={toggleSlur}>
                  <Spline className="size-4" />
                </PanelButton>
                <PanelButton title="Dot" disabled={!hasSelectedNotes} onClick={toggleDot}>
                  <Circle className="size-4 fill-current" />
                </PanelButton>
                <PanelButton title="Triplet" disabled={!hasSelectedNotes} onClick={toggleTriplet}>
                  <span className="text-sm font-medium">3</span>
                </PanelButton>
              </div>
            </PanelSection>

            <PanelSection title="Pitch">
              <div className="flex flex-wrap gap-2">
                <PanelButton title="Octave up" disabled={!canTranspose} onClick={() => transposeSelection(12)}>
                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    <span>8</span>
                    <ArrowUp className="size-3.5" />
                  </span>
                </PanelButton>
                <PanelButton title="Octave down" disabled={!canTranspose} onClick={() => transposeSelection(-12)}>
                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    <span>8</span>
                    <ArrowDown className="size-3.5" />
                  </span>
                </PanelButton>
              </div>
            </PanelSection>

            <PanelSection title="Markup">
              <div className="flex flex-wrap gap-2">
                <PanelButton
                  active={useEditorStore.getState().toolMode === 'text'}
                  onClick={() => {
                    setToolMode('text')
                    setActiveToolGroup('selection')
                    closeOpenPanel()
                  }}
                >
                  <Type className="size-4" />
                  Text
                </PanelButton>
                {DYNAMIC_OPTIONS.map((dynamic) => (
                  <PanelButton
                    key={dynamic}
                    active={primarySelectedNote?.dynamic === dynamic}
                    disabled={!hasSelectedNotes}
                    onClick={() => applyDynamic(dynamic)}
                  >
                    {dynamic}
                  </PanelButton>
                ))}
                <PanelButton
                  active={showChordDiagrams}
                  onClick={() => {
                    if (chordDiagramGlobal === 'hidden') setChordDiagramGlobal('top')
                    toggleChordDiagrams()
                  }}
                >
                  Chord diagrams
                </PanelButton>
              </div>
            </PanelSection>
          </div>
        )
      case 'bar':
        return (
          <div className="space-y-3">
            <PanelSection title="Add bars">
              <div className="flex flex-wrap gap-2">
                {[1, 4, 8, 16].map((count) => (
                  <PanelButton key={count} onClick={() => addBars(count)}>
                    {count}
                  </PanelButton>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] font-medium text-text-muted">Count</span>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={addBarsCount}
                    onChange={(event) => setAddBarsCount(event.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                    className="h-9 rounded-xl border border-border bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-border-hover"
                  />
                </label>
                <Button type="button" variant="outline" onClick={() => addBars(Number(addBarsCount) || 1)}>
                  Add
                </Button>
              </div>
            </PanelSection>

            <PanelSection title="Structure">
              <div className="flex flex-wrap gap-2">
                {BARLINE_OPTIONS.map((option) => (
                  <PanelButton
                    key={option.value}
                    active={selectedMeasureMeta?.barlineType === option.value || (!selectedMeasureMeta?.barlineType && option.value === 'single')}
                    disabled={!hasMeasureContext}
                    onClick={() => applyBarline(option.value)}
                  >
                    {option.label}
                  </PanelButton>
                ))}
              </div>
            </PanelSection>

            <PanelSection title="Repeats">
              <div className="flex flex-wrap gap-2">
                <PanelButton disabled={!hasMeasureContext} onClick={() => setRepeatEnabled('start')}>
                  Repeat start
                </PanelButton>
                <PanelButton disabled={!hasMeasureContext} onClick={() => setRepeatEnabled('end')}>
                  Repeat end
                </PanelButton>
                {REPEAT_MARKER_OPTIONS.map((option) => (
                  <PanelButton
                    key={option.value}
                    active={selectedMeasureMeta?.repeatMarker === option.value}
                    disabled={!hasMeasureContext}
                    onClick={() => applyRepeatMarker(option.value)}
                  >
                    {option.label}
                  </PanelButton>
                ))}
              </div>
            </PanelSection>
          </div>
        )
      case 'view':
        return (
          <div className="space-y-3">
            <PanelSection title="View">
              <div className="flex gap-2">
                <PanelButton active={viewMode === 'tab'} onClick={() => setViewMode('tab')}>Tab</PanelButton>
                <PanelButton active={viewMode === 'split'} onClick={() => setViewMode('split')}>Split</PanelButton>
                <PanelButton active={viewMode === 'staff'} onClick={() => setViewMode('staff')}>Staff</PanelButton>
              </div>
            </PanelSection>
          </div>
        )
      default:
        return null
    }
  })()

  return (
    <>
      <div
        ref={toolbarRef}
        onMouseLeave={closeOpenPanel}
        className={cn('pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2', className)}
      >
        {panelContent ? (
          <div
            className={cn(
              'pointer-events-auto absolute bottom-full mb-3 rounded-[20px] border border-border bg-surface-0 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]',
              openPanel === 'note' ? 'w-[min(92vw,440px)]' : 'w-[min(92vw,360px)]',
            )}
            style={panelAnchor ? { left: `${panelAnchor.left}px`, transform: 'translateX(-50%)' } : { left: '50%', transform: 'translateX(-50%)' }}
          >
            {panelContent}
          </div>
        ) : null}

        <div className="pointer-events-auto rounded-[18px] border border-border bg-surface-0 p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              <TransportButton
                icon={<SkipBack className="size-4" />}
                label="Back to beginning"
                onClick={handleBackToBeginning}
              />
              <TransportButton
                icon={isPlaying ? <Square className="size-4" /> : <Play className="size-4" />}
                label={isPlaying ? 'Stop playback' : 'Play'}
                selected={isPlaying}
                onClick={handleTogglePlayback}
              />
              <TransportButton
                icon={<Square className="size-4" />}
                label="Stop"
                onClick={handleStopPlayback}
              />
            </div>
            <div className="mx-1 h-7 w-px bg-border" aria-hidden="true" />
            <ToolbarGroupButton
              icon={<NotationGlyph glyph={BAR_GROUP_GLYPH} className="text-[18px]" />}
              label="Bar"
              selected={openPanel === 'bar'}
              onClick={(event) => handleOpenPanel('bar', event)}
              onMouseEnter={(event) => handleHoverOpenPanel('bar', event)}
            />
            <ToolbarGroupButton
              icon={<NotationGlyph glyph={NOTE_GROUP_GLYPH} className="text-[20px]" />}
              label="Note"
              selected={openPanel === 'note' || activeToolGroup === 'note' || activeToolGroup === 'rest'}
              onClick={(event) => handleOpenPanel('note', event)}
              onMouseEnter={(event) => handleHoverOpenPanel('note', event)}
            />
            <ToolbarGroupButton
              icon={<NotationGlyph glyph={EFFECT_GROUP_GLYPH} className="text-[20px]" />}
              label="Effect"
              selected={openPanel === 'effect'}
              onClick={(event) => handleOpenPanel('effect', event)}
              onMouseEnter={(event) => handleHoverOpenPanel('effect', event)}
            />
            <div className="mx-1 h-7 w-px bg-border" aria-hidden="true" />
            <ToolbarGroupButton
              icon={<ZoomIn className="size-4" />}
              label="View"
              selected={openPanel === 'view'}
              onClick={(event) => handleOpenPanel('view', event)}
              onMouseEnter={(event) => handleHoverOpenPanel('view', event)}
            />
          </div>
        </div>
      </div>
    </>
  )
}
