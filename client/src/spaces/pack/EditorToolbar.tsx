import type { ComponentType } from 'react'
import {
  Play, Pause, RotateCcw, MousePointer2, BoxSelect,
  Hash, Music, Type, Undo2, Redo2,
  Plus, Trash2, ZoomOut, ZoomIn, Layers,
  Guitar, Grid3x3, Columns2,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore, type ViewMode } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'
import { useVersionStore } from '@/stores/versionStore'
import { VersionPicker } from './VersionPicker'

interface EditorToolbarProps {
  onAddBar: () => void
  onDeleteBars: () => void
  onStylePicker: () => void
  onCompare: () => void
  totalBars?: number
  beatsPerBar?: number
  className?: string
}

function ToolButton({
  icon: Icon,
  active,
  disabled,
  onClick,
  label,
}: {
  icon: ComponentType<{ className?: string }>
  active?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'flex size-8 items-center justify-center rounded-lg transition-colors',
          active
            ? 'bg-surface-3 text-accent'
            : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          disabled && 'cursor-not-allowed opacity-40',
        )}
      >
        <Icon className="size-4" />
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-4 px-2 py-0.5 text-[11px] font-medium text-accent opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  )
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />
}

function barsToSeconds(bar: number, bpm: number, beatsPerBar: number) {
  return bar * beatsPerBar * (60 / bpm)
}

function isRunningState(state: string) {
  return state !== 'stopped' && state !== 'paused' && state !== 'locating'
}

const VIEW_MODE_LABELS: Record<string, string> = {
  staff: 'Staff view',
  leadSheet: 'Lead sheet',
  tab: 'Tab view',
}

const VIEW_MODES: ViewMode[] = ['staff', 'leadSheet', 'tab']

export function EditorToolbar({
  onAddBar,
  onDeleteBars,
  onStylePicker: _onStylePicker,
  onCompare,
  totalBars = 16,
  beatsPerBar = 4,
  className,
}: EditorToolbarProps) {
  const toolMode = useEditorStore((s) => s.toolMode)
  const setToolMode = useEditorStore((s) => s.setToolMode)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selectedBars = useEditorStore((s) => s.selectedBars)
  const canUndo = useEditorStore((s) => s.undoStack.length > 0)
  const canRedo = useEditorStore((s) => s.redoStack.length > 0)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const showChordDiagrams = useEditorStore((s) => s.showChordDiagrams)
  const showBeatMarkers = useEditorStore((s) => s.showBeatMarkers)
  const toggleChordDiagrams = useEditorStore((s) => s.toggleChordDiagrams)
  const toggleBeatMarkers = useEditorStore((s) => s.toggleBeatMarkers)
  const editorMode = useEditorStore((s) => s.editorMode)
  const setEditorMode = useEditorStore((s) => s.setEditorMode)
  const isPreview = useVersionStore((s) => s.previewVersionId !== null)
  const versionCount = useVersionStore((s) => s.versions.length)

  const transportState = useAudioStore((s) => s.transportState)
  const setTransportState = useAudioStore((s) => s.setTransportState)
  const currentBar = useAudioStore((s) => s.currentBar)
  const setCurrentBar = useAudioStore((s) => s.setCurrentBar)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const bpm = useAudioStore((s) => s.bpm)

  const safeTotalBars = Math.max(1, totalBars)
  const isPlaying = isRunningState(transportState)
  const clampedBar = Math.max(0, Math.min(currentBar, safeTotalBars))
  const displayBar = Math.min(safeTotalBars, Math.max(1, Math.floor(clampedBar) + 1))
  const sliderValue = Math.round((clampedBar / safeTotalBars) * 1000)

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
  }

  const handleTogglePlayback = () => {
    if (isPlaying) {
      setTransportState('paused')
    } else {
      if (clampedBar >= safeTotalBars) {
        setCurrentBar(0)
        setCurrentTime(0)
      }
      setTransportState('rolling')
    }
  }

  const handleRestart = () => {
    setTransportState('stopped')
    setCurrentBar(0)
    setCurrentTime(0)
  }

  return (
    <div
      className={cn(
        'absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-stretch gap-2',
        className,
      )}
    >
      {/* Standalone scrubber — iOS style: dim at rest, full opacity on hover/focus */}
      <div className="group/scrub px-2 opacity-30 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={sliderValue}
          onChange={(e) => locateToBar((Number(e.target.value) / 1000) * safeTotalBars)}
          aria-label={`Playback position — bar ${displayBar} of ${safeTotalBars}`}
          className={cn(
            'block w-full cursor-pointer appearance-none bg-transparent',
            // Track
            '[&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-text-primary',
            '[&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-text-primary [&::-moz-range-track]:border-0',
            // Thumb
            '[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-primary',
            '[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-text-primary',
          )}
        />
      </div>

      {/* Toolbar pill */}
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface-0 px-2 py-1.5 shadow-lg">
        {/* Mode switch — always visible */}
        <div className="flex items-center rounded-lg bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setEditorMode('transform')}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
              editorMode === 'transform'
                ? 'bg-surface-0 text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            Default
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('fineEdit')}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
              editorMode === 'fineEdit'
                ? 'bg-surface-0 text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            Edit
          </button>
        </div>

        <Divider />

        {/* Playback — always visible */}
        <ToolButton
          icon={isPlaying ? Pause : Play}
          onClick={handleTogglePlayback}
          label={isPlaying ? 'Pause' : 'Play'}
        />
        <ToolButton icon={RotateCcw} onClick={handleRestart} label="Restart" />
        <span
          className="min-w-[3rem] px-1 text-center text-[11px] font-mono text-text-muted"
          title="Tempo"
        >
          {bpm} BPM
        </span>

        <Divider />

        {/* Selection — always visible */}
        <ToolButton
          icon={MousePointer2}
          active={toolMode === 'pointer'}
          onClick={() => setToolMode('pointer')}
          label="Select"
        />
        <ToolButton
          icon={BoxSelect}
          active={toolMode === 'range'}
          onClick={() => setToolMode('range')}
          label="Range select"
        />

        {editorMode === 'transform' && (
          <>
            <Divider />
            {/* Version picker */}
            <VersionPicker />

            {/* Compare */}
            <ToolButton
              icon={Columns2}
              onClick={onCompare}
              disabled={versionCount <= 1 || isPreview}
              label="Compare with original"
            />
          </>
        )}

        {editorMode === 'fineEdit' && (
          <>
            <Divider />

            {/* Editing tools */}
            <ToolButton
              icon={Hash}
              active={toolMode === 'chord'}
              onClick={() => setToolMode('chord')}
              label="Edit chord"
            />
            <ToolButton
              icon={Music}
              active={toolMode === 'keySig'}
              onClick={() => setToolMode('keySig')}
              label="Key & time sig"
            />
            <ToolButton
              icon={Type}
              active={toolMode === 'text'}
              onClick={() => setToolMode('text')}
              label="Add annotation"
            />

            <Divider />

            {/* History */}
            <ToolButton icon={Undo2} onClick={undo} disabled={!canUndo} label="Undo" />
            <ToolButton icon={Redo2} onClick={redo} disabled={!canRedo} label="Redo" />

            <Divider />

            {/* Bar management */}
            <ToolButton icon={Plus} onClick={onAddBar} label="Add bar" />
            <ToolButton
              icon={Trash2}
              onClick={onDeleteBars}
              disabled={selectedBars.length === 0}
              label="Delete bar"
            />

            <Divider />

            {/* View mode cycle */}
            <ToolButton
              icon={Layers}
              label={VIEW_MODE_LABELS[viewMode] ?? 'View mode'}
              onClick={() => {
                const next = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length]
                setViewMode(next)
              }}
            />

            <Divider />

            {/* Training wheels */}
            <ToolButton
              icon={Guitar}
              label="Chord shapes"
              active={showChordDiagrams}
              onClick={toggleChordDiagrams}
            />
            <ToolButton
              icon={Grid3x3}
              label="Beat grid"
              active={showBeatMarkers}
              onClick={toggleBeatMarkers}
            />
          </>
        )}

        <Divider />

        {/* Zoom — always visible */}
        <ToolButton icon={ZoomOut} onClick={() => setZoom(zoom - 10)} disabled={zoom <= 50} label="Zoom out" />
        <span className="min-w-[2.5rem] text-center text-xs font-mono text-text-secondary">
          {zoom}%
        </span>
        <ToolButton icon={ZoomIn} onClick={() => setZoom(zoom + 10)} disabled={zoom >= 200} label="Zoom in" />
      </div>
    </div>
  )
}
