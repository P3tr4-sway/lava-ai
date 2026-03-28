import type { ComponentType } from 'react'
import {
  Play, Pause, MousePointer2, BoxSelect,
  Hash, Music, Type, Undo2, Redo2,
  Plus, Trash2, Disc3, ZoomOut, ZoomIn, Layers,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore, type ToolMode, type ViewMode } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'

interface EditorToolbarProps {
  onPlayPause: () => void
  onAddBar: () => void
  onDeleteBars: () => void
  onStylePicker: () => void
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
    <button
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
  )
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />
}

export function EditorToolbar({
  onPlayPause,
  onAddBar,
  onDeleteBars,
  onStylePicker,
  className,
}: EditorToolbarProps) {
  const toolMode = useEditorStore((s) => s.toolMode)
  const setToolMode = useEditorStore((s) => s.setToolMode)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selectedBars = useEditorStore((s) => s.selectedBars)

  const playbackState = useAudioStore((s) => s.playbackState)
  const bpm = useAudioStore((s) => s.bpm)

  const canUndo = useEditorStore((s) => s.undoStack.length > 0)
  const canRedo = useEditorStore((s) => s.redoStack.length > 0)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  const isPlaying = playbackState === 'playing'

  return (
    <div
      className={cn(
        'absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full border border-border bg-surface-0 px-2 py-1.5 shadow-lg',
        className,
      )}
    >
      {/* Playback */}
      <ToolButton
        icon={isPlaying ? Pause : Play}
        onClick={onPlayPause}
        label={isPlaying ? 'Pause' : 'Play'}
      />
      <span
        className="min-w-[3rem] px-1.5 text-center text-xs font-mono text-text-secondary"
        title="Tempo"
      >
        {bpm}
      </span>

      <Divider />

      {/* Selection */}
      <ToolButton
        icon={MousePointer2}
        active={toolMode === 'pointer'}
        onClick={() => setToolMode('pointer')}
        label="Pointer tool"
      />
      <ToolButton
        icon={BoxSelect}
        active={toolMode === 'range'}
        onClick={() => setToolMode('range')}
        label="Range select"
      />

      <Divider />

      {/* Editing */}
      <ToolButton
        icon={Hash}
        active={toolMode === 'chord'}
        onClick={() => setToolMode('chord')}
        label="Chord tool"
      />
      <ToolButton
        icon={Music}
        active={toolMode === 'keySig'}
        onClick={() => setToolMode('keySig')}
        label="Key/time signature"
      />
      <ToolButton
        icon={Type}
        active={toolMode === 'text'}
        onClick={() => setToolMode('text')}
        label="Text annotation"
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
        label="Delete selected bars"
      />

      <Divider />

      {/* Style picker */}
      <ToolButton icon={Disc3} onClick={onStylePicker} label="Playback style" />

      <Divider />

      {/* Zoom + View */}
      <ToolButton icon={ZoomOut} onClick={() => setZoom(zoom - 10)} disabled={zoom <= 50} label="Zoom out" />
      <span className="min-w-[2.5rem] text-center text-xs font-mono text-text-secondary">
        {zoom}%
      </span>
      <ToolButton icon={ZoomIn} onClick={() => setZoom(zoom + 10)} disabled={zoom >= 200} label="Zoom in" />

      <Divider />

      {/* View mode */}
      <ToolButton
        icon={Layers}
        label="View mode"
        onClick={() => {
          const modes: ViewMode[] = ['staff', 'leadSheet', 'tab']
          const next = modes[(modes.indexOf(viewMode) + 1) % modes.length]
          setViewMode(next)
        }}
      />
    </div>
  )
}
