import React, { useCallback, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Drum,
  FileAudio,
  FileText,
  Guitar,
  Layers,
  Loader2,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Piano,
  Upload,
  Waves,
  X,
} from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { cn } from '@/components/ui/utils'
import type { TrackNode } from '@/editor/ast/types'
import { classifyImportFile } from '@/io/file-import'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerationConfig {
  file: File | null
  mode: 'transcribe' | 'rearrange'
  stylePrompt: string
  instrument: string
  notationMode: 'manual' | 'ai'
  difficulty: 0 | 1 | 2
  creativity: number
}

interface EditorInstrumentPanelProps {
  tracks: TrackNode[]
  visibleTrackIndices: number[]
  onToggleTrack: (index: number) => void
  onShowAll: () => void
  onGenerate: (config: GenerationConfig) => Promise<void>
  isGenerating?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSTRUMENTS = [
  { value: 'guitar', label: 'Guitar' },
  { value: 'bass', label: 'Bass' },
  { value: 'piano', label: 'Piano' },
  { value: 'drums', label: 'Drums' },
  { value: 'violin', label: 'Violin' },
  { value: 'ukulele', label: 'Ukulele' },
] as const

type InstrumentFamily = 'guitar' | 'bass' | 'keys' | 'strings' | 'drums' | 'other'

function getMidiFamily(program: number): InstrumentFamily {
  if (program < 0) return 'drums'
  if (program <= 23) return 'keys'
  if (program <= 31) return 'guitar'
  if (program <= 39) return 'bass'
  if (program <= 47) return 'strings'
  if (program >= 112 && program <= 119) return 'drums'
  return 'other'
}

function InstrumentIcon({ program, className: cls }: { program: number; className?: string }) {
  const props = { className: cn('shrink-0', cls) }
  switch (getMidiFamily(program)) {
    case 'guitar':  return <Guitar {...props} />
    case 'bass':    return <Waves {...props} />
    case 'keys':    return <Piano {...props} />
    case 'strings': return <Layers {...props} />
    case 'drums':   return <Drum {...props} />
    default:        return <Music {...props} />
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
      {children}
    </p>
  )
}

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 py-1.5 text-[12px] transition-colors',
            value === opt.value
              ? 'bg-surface-3 font-medium text-text-primary'
              : 'text-text-muted hover:bg-surface-1 hover:text-text-secondary',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function TrackRow({ icon, label, checked, onClick }: {
  icon: React.ReactNode
  label: string
  checked: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors',
        checked ? 'text-text-primary' : 'text-text-muted hover:bg-surface-1 hover:text-text-secondary',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded border',
        checked ? 'border-text-primary bg-text-primary' : 'border-border',
      )}>
        {checked && <Check className="size-2.5 text-surface-0" />}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EditorInstrumentPanel({
  tracks,
  visibleTrackIndices,
  onToggleTrack,
  onShowAll,
  onGenerate,
  isGenerating = false,
  className,
}: EditorInstrumentPanelProps) {
  const collapsed = useEditorStore((s) => s.instrumentPanelCollapsed)
  const togglePanel = useEditorStore((s) => s.toggleInstrumentPanel)

  // Generation state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'transcribe' | 'rearrange'>('transcribe')
  const [stylePrompt, setStylePrompt] = useState('')
  const [instrument, setInstrument] = useState('guitar')
  const [notationMode, setNotationMode] = useState<'manual' | 'ai'>('ai')
  const [difficulty, setDifficulty] = useState<0 | 1 | 2>(1)
  const [creativity, setCreativity] = useState(50)
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const allVisible = tracks.length > 0 && visibleTrackIndices.length === tracks.length

  const handleFileSelect = useCallback((file: File) => {
    setUploadedFile(file)
  }, [])

  const handleGenerate = useCallback(() => {
    void onGenerate({ file: uploadedFile, mode, stylePrompt, instrument, notationMode, difficulty, creativity })
  }, [onGenerate, uploadedFile, mode, stylePrompt, instrument, notationMode, difficulty, creativity])

  const generateLabel = isGenerating
    ? 'Generating…'
    : uploadedFile && mode === 'transcribe'
    ? 'Transcribe'
    : uploadedFile && mode === 'rearrange'
    ? 'Rearrange'
    : 'Generate'

  const fileType = uploadedFile ? classifyImportFile(uploadedFile) : null
  const FileIcon = fileType === 'audio' ? FileAudio : FileText

  // ── Collapsed strip ──────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className={cn('flex w-10 flex-col items-center border-r border-border bg-surface-0 pt-3', className)}>
        <button
          type="button"
          onClick={togglePanel}
          aria-label="Open score panel"
          className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </div>
    )
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div className={cn('flex w-[260px] min-w-[260px] flex-col border-r border-border bg-surface-0', className)}>

      {/* Header */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-4">
        <p className="text-sm font-semibold text-text-primary">Score</p>
        <button
          type="button"
          onClick={togglePanel}
          aria-label="Collapse score panel"
          className="flex size-7 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Source ─────────────────────────────────────── */}
        <div className="border-b border-border px-4 py-4">
          <SectionLabel>Source</SectionLabel>

          {!uploadedFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-left transition-colors hover:border-border-hover hover:bg-surface-1"
            >
              <Upload className="size-4 shrink-0 text-text-muted" />
              <div>
                <p className="text-[12px] font-medium text-text-secondary">Upload audio or score</p>
                <p className="text-[11px] text-text-muted">GP, MusicXML, PDF, audio</p>
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              {/* File chip */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2">
                <FileIcon className="size-3.5 shrink-0 text-text-secondary" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-text-primary">
                  {uploadedFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-text-muted hover:text-text-primary"
                >
                  <X className="size-3" />
                </button>
              </div>

              {/* Mode selector */}
              <SegmentControl
                options={[
                  { value: 'transcribe' as const, label: 'Transcribe' },
                  { value: 'rearrange' as const, label: 'Rearrange' },
                ]}
                value={mode}
                onChange={setMode}
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".gp,.gp4,.gp5,.gpx,.gp7,.musicxml,.mxl,.xml,audio/*,.pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
              e.target.value = ''
            }}
          />
        </div>

        {/* ── Style ──────────────────────────────────────── */}
        <div className="border-b border-border px-4 py-4">
          <SectionLabel>Style</SectionLabel>
          <textarea
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder="Describe the style… e.g. fingerstyle guitar, jazz harmony, slow ballad"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-surface-1 px-3 py-2 text-[12px] text-text-primary placeholder:text-text-muted focus:border-border-hover focus:outline-none"
          />
        </div>

        {/* ── More Options ───────────────────────────────── */}
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setMoreOptionsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <SectionLabel>More Options</SectionLabel>
            <ChevronDown className={cn(
              'size-3.5 text-text-muted transition-transform',
              moreOptionsOpen && 'rotate-180',
            )} />
          </button>

          {moreOptionsOpen && (
            <div className="space-y-4 px-4 pb-4">

              {/* Instrument */}
              <div>
                <p className="mb-1.5 text-[11px] text-text-muted">Instrument</p>
                <select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-[12px] text-text-primary focus:outline-none focus:border-border-hover"
                >
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst.value} value={inst.value}>{inst.label}</option>
                  ))}
                </select>
              </div>

              {/* Notation Mode */}
              <div>
                <p className="mb-1.5 text-[11px] text-text-muted">Notation Mode</p>
                <SegmentControl
                  options={[
                    { value: 'manual' as const, label: 'Manual' },
                    { value: 'ai' as const, label: 'AI' },
                  ]}
                  value={notationMode}
                  onChange={setNotationMode}
                />
              </div>

              {/* Difficulty */}
              <div>
                <p className="mb-1.5 text-[11px] text-text-muted">Difficulty</p>
                <div className="flex gap-1">
                  {(['Beginner', 'Intermediate', 'Advanced'] as const).map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDifficulty(idx as 0 | 1 | 2)}
                      className={cn(
                        'flex-1 rounded py-1 text-[11px] transition-colors',
                        difficulty === idx
                          ? 'bg-surface-4 font-medium text-text-primary'
                          : 'border border-border text-text-muted hover:border-border-hover hover:text-text-secondary',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Creativity slider */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] text-text-muted">Creativity</p>
                  <p className="text-[11px] tabular-nums text-text-muted">{creativity}%</p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={creativity}
                  onChange={(e) => setCreativity(Number(e.target.value))}
                  className="w-full accent-text-primary"
                />
              </div>

            </div>
          )}
        </div>

        {/* ── Tracks (when score is loaded) ──────────────── */}
        {tracks.length > 0 && (
          <div>
            <div className="px-4 pb-1 pt-4">
              <SectionLabel>Tracks</SectionLabel>
            </div>

            {tracks.length > 1 && (
              <>
                <TrackRow
                  icon={<Layers className="size-3.5 text-text-muted" />}
                  label="Show all"
                  checked={allVisible}
                  onClick={onShowAll}
                />
                <div className="mx-4 my-1 border-t border-border" />
              </>
            )}

            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                icon={<InstrumentIcon program={track.instrument} className="size-3.5 text-text-muted" />}
                label={track.name || `Track ${index + 1}`}
                checked={visibleTrackIndices.includes(index)}
                onClick={() => onToggleTrack(index)}
              />
            ))}
          </div>
        )}

      </div>

      {/* Generate button (fixed bottom) */}
      <div className="flex-shrink-0 border-t border-border p-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-surface-0 transition-opacity disabled:opacity-50 hover:opacity-90"
        >
          {isGenerating
            ? <Loader2 className="size-4 animate-spin" />
            : <Music className="size-4" />
          }
          {generateLabel}
        </button>
      </div>

    </div>
  )
}
