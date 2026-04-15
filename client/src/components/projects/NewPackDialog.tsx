import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronDown, Loader2, Pause, Play, Sparkles, X } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import { cn } from '@/components/ui/utils'
import { projectService } from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'
import {
  buildNewPackProjectPayload,
  NEW_PACK_TUNINGS,
  type NewPackDraft,
  type NewPackLayout,
  type NewPackTuningId,
} from '@/spaces/pack/newPack'
import { FileUploadZone } from './FileUploadZone'
import { FileUploadChip } from './FileUploadChip'
import { AiPromptInput } from './AiPromptInput'
import {
  classifyImportFile,
  extractDraftFromGpFile,
  extractDraftFromMusicXmlFile,
  type ImportFileType,
} from '@/io/file-import'
import type { ScoreDocument } from '@lava/shared'

type ImportSourceKind = 'audio' | 'youtube' | 'musicxml' | 'pdf-image'

interface NewPackDialogProps {
  open: boolean
  onClose: () => void
  mode?: 'default' | 'import'
  initialDraft?: NewPackDraft | null
  initialRequestSummary?: string
  sourceLabel?: string
  importSource?: ImportSourceKind | null
  detectedFields?: Array<{ label: string; value: string }>
  submitLabel?: string
  onSubmitDraft?: (draft: NewPackDraft, requestSummary: string) => Promise<void> | void
  onAiStyleSubmit?: (draft: NewPackDraft, aiPrompt: string) => void
  previewVersionLabel?: string
  previewStatus?: 'ready' | 'generating' | 'error'
  previewError?: string | null
  previewAudioUrl?: string | null
  onRegeneratePreview?: () => Promise<void> | void
}

interface PresetOption {
  id: string
  label: string
  description: string
  draft: Omit<NewPackDraft, 'name'>
}

const BAR_OPTIONS = [8, 12, 16, 32, 64]
const KEY_OPTIONS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Am', 'Em']
const TIME_SIGNATURE_OPTIONS = ['4/4', '3/4', '6/8', '12/8']

const LAYOUT_OPTIONS: Array<{ value: NewPackLayout; label: string }> = [
  { value: 'tab', label: 'Tabs only' },
  { value: 'split', label: 'Staff + Tabs' },
  { value: 'staff', label: 'Staff' },
]

const PLAYING_STYLE_OPTIONS = [
  {
    id: 'fingerpicking',
    label: 'Fingerstyle',
    description: 'Arrangement for guitar',
    requestLabel: 'Fingerstyle',
  },
  {
    id: 'strumming',
    label: 'Strumming',
    description: 'Rhythm · Chord diagrams',
    requestLabel: 'Strumming',
  },
  {
    id: 'lead-solo',
    label: 'Lead / Solo',
    description: 'Single-note melody · Bends',
    requestLabel: 'Lead / Solo',
  },
  {
    id: 'chord-melody',
    label: 'Chord Melody',
    description: 'Leadsheet',
    requestLabel: 'Chord melody',
  },
] as const

const DISPLAY_OPTIONS = [
  { value: 'tab', label: 'Tab only', summaryLabel: 'Tab only' },
  { value: 'split', label: 'Tab + Standard notation', summaryLabel: 'Tab + notation' },
  { value: 'staff', label: 'Chord diagrams only', summaryLabel: 'Chord diagrams' },
] as const satisfies ReadonlyArray<{ value: NewPackLayout; label: string; summaryLabel: string }>

const DIFFICULTY_OPTIONS = [
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Beginner - simplified voicings',
    requestLabel: 'Beginner',
    requestDetail: 'simplified voicings',
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Standard',
    requestLabel: 'Standard',
    requestDetail: 'balanced readability',
  },
  {
    id: 'full',
    label: 'Full transcription',
    description: 'Full transcription',
    requestLabel: 'Full transcription',
    requestDetail: 'include nuance and detail',
  },
] as const

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'blank-setup',
    label: 'Blank Setup',
    description: 'Start from scratch.',
    draft: {
      bars: 16,
      tempo: 96,
      timeSignature: '4/4',
      key: 'C',
      layout: 'tab',
      tuning: 'standard',
      capo: 0,
    },
  },
  {
    id: 'fingerstyle',
    label: 'Fingerstyle',
    description: 'Melody-led solo guitar.',
    draft: {
      bars: 16,
      tempo: 72,
      timeSignature: '4/4',
      key: 'C',
      layout: 'split',
      tuning: 'standard',
      capo: 0,
    },
  },
  {
    id: 'lead-solo',
    label: 'Lead / Solo',
    description: 'Single-note lines and bends.',
    draft: {
      bars: 32,
      tempo: 100,
      timeSignature: '4/4',
      key: 'C',
      layout: 'tab',
      tuning: 'standard',
      capo: 0,
    },
  },
  {
    id: 'rhythm-guitar',
    label: 'Rhythm Guitar',
    description: 'Chords and strumming tabs.',
    draft: {
      bars: 32,
      tempo: 88,
      timeSignature: '4/4',
      key: 'C',
      layout: 'tab',
      tuning: 'standard',
      capo: 0,
    },
  },
  {
    id: 'lead-sheet',
    label: 'Lead Sheet',
    description: 'Staff, chords, and structure.',
    draft: {
      bars: 32,
      tempo: 86,
      timeSignature: '4/4',
      key: 'C',
      layout: 'staff',
      tuning: 'standard',
      capo: 0,
    },
  },
]

const DEFAULT_PRESET_ID = PRESET_OPTIONS[0].id
const DEFAULT_DRAFT: NewPackDraft = {
  name: 'Untitled Project',
  ...PRESET_OPTIONS[0].draft,
}

const CARD_CLASS_NAME =
  'rounded-2xl bg-[#f7f6f3] px-4 py-3 text-left'

const VALUE_INPUT_CLASS_NAME =
  'w-full border-0 bg-transparent p-0 text-[16px] font-medium leading-[1.2] text-[#111111] outline-none placeholder:text-[#a3a3a3]'

// ---------------------------------------------------------------------------
// Mock AI processing stages
// ---------------------------------------------------------------------------

type AiProcessingStage = { label: string; durationMs: number }

const AI_PROCESSING_STAGES: AiProcessingStage[] = [
  { label: 'Analyzing...', durationMs: 1000 },
  { label: 'Stylizing...', durationMs: 1200 },
  { label: 'Building score...', durationMs: 800 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function getDraftForPreset(presetId: string) {
  return PRESET_OPTIONS.find((preset) => preset.id === presetId)?.draft ?? PRESET_OPTIONS[0].draft
}

function resetDraft(): NewPackDraft {
  return {
    name: DEFAULT_DRAFT.name,
    ...getDraftForPreset(DEFAULT_PRESET_ID),
  }
}

function createActionLabel(layout: NewPackLayout) {
  return layout === 'tab' ? 'Create tab project' : 'Create project'
}

function deriveStyleResultLabel(requestSummary: string) {
  const trimmed = requestSummary.trim()
  if (!trimmed) return 'Styled arrangement'

  const normalized = trimmed
    .replace(/^create\s+/i, '')
    .replace(/^turn\s+this\s+(song|audio)\s+into\s+/i, '')
    .replace(/^turn\s+into\s+/i, '')
    .replace(/^make\s+this\s+/i, '')
    .trim()

  if (!normalized) return 'Styled arrangement'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatPreviewTitle(sourceLabel: string, requestSummary: string) {
  return `${sourceLabel || 'Source track'} \u2192 ${deriveStyleResultLabel(requestSummary)}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PresetCard({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[66px] w-full flex-col items-start justify-start rounded-[18px] border px-4 py-3 text-left transition-all duration-150',
        active
          ? 'border-[#111111] bg-[#111111] text-white shadow-[0px_12px_28px_rgba(17,17,17,0.18)]'
          : 'border-[#e5e5e5] bg-[#fafafa] text-[#111111] hover:border-[#d4d4d4] hover:bg-[#f5f5f5]',
      )}
    >
      <span className="text-[14px] font-medium leading-[1.2]">{label}</span>
      <span className={cn('mt-1 text-[11px] leading-[1.35]', active ? 'text-[#d4d4d4]' : 'text-[#737373]')}>
        {description}
      </span>
    </button>
  )
}

function DetailCard({
  label,
  helper,
  className,
  children,
}: {
  label: string
  helper?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn(CARD_CLASS_NAME, 'flex min-h-[84px] flex-col gap-1.5', className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#737373]">{label}</p>
      <div className="flex-1">{children}</div>
      {helper ? <p className="text-[11px] leading-[1.35] text-[#8a8a8a]">{helper}</p> : null}
    </section>
  )
}

function ImportStageCard({
  title,
  status,
  error,
  action,
  children,
}: {
  title: string
  status?: React.ReactNode
  error?: string | null
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 space-y-2.5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[15px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#111111]">{title}</h4>
              {status}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        {children}

        {error ? (
          <div role="alert" className="inline-flex items-center gap-2 text-[12px] font-medium text-[#b24d37]">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SelectValue({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(VALUE_INPUT_CLASS_NAME, 'appearance-none pr-7')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#8a8a8a]"
      />
    </div>
  )
}

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

interface WaveformPlayerHandle {
  pause: () => void
}

const WaveformPlayer = forwardRef<
  WaveformPlayerHandle,
  { url?: string | null; status: 'ready' | 'generating' | 'error'; isSelected?: boolean }
>(function WaveformPlayer({ url, status, isSelected = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [wsReady, setWsReady] = useState(false)

  useImperativeHandle(ref, () => ({
    pause: () => wsRef.current?.pause(),
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container || !url) return

    setWsReady(false)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)

    const ws = WaveSurfer.create({
      container,
      waveColor: isSelected ? '#555555' : '#d0cfc9',
      progressColor: isSelected ? '#ffffff' : '#111111',
      cursorColor: isSelected ? '#ffffff' : '#111111',
      cursorWidth: 2,
      height: 32,
      barWidth: 3,
      barGap: 2,
      barRadius: 100,
      normalize: true,
      interact: true,
    })

    wsRef.current = ws
    ws.load(url)

    ws.on('ready', () => {
      setDuration(ws.getDuration())
      setWsReady(true)
    })
    ws.on('timeupdate', (t) => setCurrentTime(t))
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // Update waveform colors live when selection state changes
  useEffect(() => {
    wsRef.current?.setOptions({
      waveColor: isSelected ? '#555555' : '#d0cfc9',
      progressColor: isSelected ? '#ffffff' : '#111111',
      cursorColor: isSelected ? '#ffffff' : '#111111',
    })
  }, [isSelected])

  const handlePlayPause = useCallback(() => {
    wsRef.current?.playPause()
  }, [])

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handlePlayPause}
        disabled={url ? !wsReady : status !== 'ready'}
        aria-label={isPlaying ? 'Pause audio preview' : 'Play audio preview'}
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
          isSelected
            ? 'bg-white text-[#111111] hover:opacity-90 focus-visible:ring-white'
            : 'bg-[#111111] text-white hover:opacity-90 focus-visible:ring-[#111111]',
        )}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      <div className="min-w-0 flex-1">
        {url ? (
          <div ref={containerRef} className="w-full" />
        ) : (
          <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
            {[16, 24, 12, 30, 18, 26, 10, 20, 14, 28, 16, 22, 18, 12, 26, 20, 10, 24, 14, 28].map((height, i) => (
              <span
                key={i}
                className={cn(
                  'flex-1 rounded-full',
                  isSelected ? 'bg-white/20' : 'bg-black/12',
                  status === 'generating' && 'animate-pulse',
                )}
                style={{ height }}
              />
            ))}
          </div>
        )}
      </div>

      <span className={cn('shrink-0 font-mono text-[11px] tabular-nums', isSelected ? 'text-white/60' : 'text-[#7b7b75]')}>
        {fmtTime(currentTime)} / {duration > 0 ? fmtTime(duration) : '00:12'}
      </span>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Mock AI Processing Overlay (inline in the dialog body)
// ---------------------------------------------------------------------------

function AiProcessingOverlay({
  stageIndex,
  stages,
}: {
  stageIndex: number
  stages: AiProcessingStage[]
}) {
  const progress = Math.round(((stageIndex + 1) / stages.length) * 100)

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className="flex items-center gap-3">
        <Loader2 size={20} className="animate-spin text-[#111111]" />
        <p className="text-[15px] font-medium text-[#111111]">
          {stages[stageIndex]?.label ?? 'Processing...'}
        </p>
      </div>
      <div className="h-1.5 w-48 rounded-full bg-[#e9e7e2]">
        <div
          className="h-full rounded-full bg-[#111111] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[11px] text-[#8a8a8a]">{progress}% complete</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function NewPackDialog({
  open,
  onClose,
  mode = 'default',
  initialDraft,
  initialRequestSummary,
  sourceLabel,
  importSource: _importSource,
  submitLabel,
  onSubmitDraft,
  onAiStyleSubmit,
  previewVersionLabel,
  previewStatus = 'ready',
  previewError = null,
  previewAudioUrl = null,
}: NewPackDialogProps) {
  const navigate = useNavigate()
  const upsertProject = useProjectStore((state) => state.upsertProject)
  const [draft, setDraft] = useState<NewPackDraft>(DEFAULT_DRAFT)
  const [activePresetId, setActivePresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [requestSummary, setRequestSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [playingStyleId, setPlayingStyleId] = useState<string>(PLAYING_STYLE_OPTIONS[0].id)
  const [difficultyId, setDifficultyId] = useState<string>(DIFFICULTY_OPTIONS[0].id)
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0)
  const versionScrollRef = useRef<HTMLDivElement>(null)
  const waveformRef0 = useRef<WaveformPlayerHandle>(null)
  const waveformRef1 = useRef<WaveformPlayerHandle>(null)
  const isImportMode = mode === 'import'

  // --- New: file upload & AI prompt state (default mode) ---
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileType, setUploadedFileType] = useState<ImportFileType | null>(null)
  const [importedScoreDocument, setImportedScoreDocument] = useState<ScoreDocument | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiStageIndex, setAiStageIndex] = useState(0)

  const sourceTitle = isImportMode
    ? 'Generate guitar score'
    : 'Create a guitar project'

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  }, [onClose])

  const selectVersion = useCallback((idx: number, scroll = true) => {
    setSelectedVersionIndex(idx)
    // Pause the other player
    ;(idx === 0 ? waveformRef1 : waveformRef0).current?.pause()
    if (!scroll) return
    const container = versionScrollRef.current
    if (!container) return
    const card = container.children[idx] as HTMLElement | undefined
    if (!card) return
    container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!open) return
    setDraft(initialDraft ?? resetDraft())
    setActivePresetId(initialDraft ? 'blank-setup' : DEFAULT_PRESET_ID)
    setRequestSummary(initialRequestSummary ?? '')
    setSubmitting(false)
    setError(null)
    setShowAdvancedSettings(false)
    setPlayingStyleId(PLAYING_STYLE_OPTIONS[0].id)
    setDifficultyId(DIFFICULTY_OPTIONS[0].id)
    setSelectedVersionIndex(0)
    // Reset file upload state
    setUploadedFile(null)
    setUploadedFileType(null)
    setImportedScoreDocument(null)
    setImporting(false)
    setImportError(null)
    setAiPrompt('')
    setAiProcessing(false)
    setAiStageIndex(0)
  }, [initialDraft, initialRequestSummary, open])

  // Use a ref callback + native listener because React's synthetic onScroll
  // doesn't fire reliably on portalled elements in this browser context.
  const selectVersionRef = useRef(selectVersion)
  selectVersionRef.current = selectVersion
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setVersionScrollRef = useCallback((node: HTMLDivElement | null) => {
    // Detach from old node
    const prev = versionScrollRef.current
    if (prev) prev.removeEventListener('scroll', (prev as { __vsPicker?: EventListener }).__vsPicker ?? (() => {}))

    ;(versionScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    if (!node) return

    const handler: EventListener = () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current)
      scrollDebounceRef.current = setTimeout(() => {
        const container = node
        const center = container.scrollLeft + container.clientWidth / 2
        let bestIdx = 0, bestDist = Infinity
        Array.from(container.children).forEach((child, i) => {
          const el = child as HTMLElement
          const cardCenter = el.offsetLeft + el.offsetWidth / 2
          const dist = Math.abs(cardCenter - center)
          if (dist < bestDist) { bestDist = dist; bestIdx = i }
        })
        selectVersionRef.current(bestIdx, false)
      }, 80)
    }
    ;(node as { __vsPicker?: EventListener }).__vsPicker = handler
    node.addEventListener('scroll', handler, { passive: true })
  }, [])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown, open])

  const updateDraft = <K extends keyof NewPackDraft>(key: K, value: NewPackDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handlePresetSelect = (presetId: string) => {
    setActivePresetId(presetId)
    setDraft((current) => ({
      ...current,
      ...getDraftForPreset(presetId),
    }))
  }

  // --- File upload handler (default mode) ---
  const handleFileSelect = useCallback(async (file: File) => {
    setUploadedFile(file)
    setImportError(null)
    setImportedScoreDocument(null)

    const fileType = classifyImportFile(file)
    setUploadedFileType(fileType)

    if (fileType === 'gp') {
      setImporting(true)
      try {
        const { draft: extracted } = await extractDraftFromGpFile(file)
        setDraft((prev) => ({
          ...prev,
          ...extracted,
          name: extracted.name || prev.name,
        }))
        // GP files don't produce a ScoreDocument directly, but the score
        // will be imported via importGpFile → tabEditorStore.setAst() on the editor side
      } catch (err) {
        setImportError((err as Error).message)
      } finally {
        setImporting(false)
      }
    } else if (fileType === 'musicxml') {
      setImporting(true)
      try {
        const { draft: extracted, scoreDocument } = await extractDraftFromMusicXmlFile(file)
        setImportedScoreDocument(scoreDocument)
        setDraft((prev) => ({
          ...prev,
          ...extracted,
          name: extracted.name || prev.name,
        }))
      } catch (err) {
        setImportError((err as Error).message)
      } finally {
        setImporting(false)
      }
    } else {
      // Audio / PDF / Image — just set name from filename
      const baseName = file.name.replace(/\.[^.]+$/, '')
      setDraft((prev) => ({ ...prev, name: baseName }))
    }
  }, [])

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null)
    setUploadedFileType(null)
    setImportedScoreDocument(null)
    setImportError(null)
  }, [])

  // --- Mock AI processing timer ---
  useEffect(() => {
    if (!aiProcessing) return

    if (aiStageIndex >= AI_PROCESSING_STAGES.length) {
      // All stages done — perform the actual create
      setAiProcessing(false)
      setAiStageIndex(0)
      performCreate()
      return
    }

    const timer = window.setTimeout(() => {
      setAiStageIndex((i) => i + 1)
    }, AI_PROCESSING_STAGES[aiStageIndex].durationMs)

    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProcessing, aiStageIndex])

  // --- Create handler ---
  const performCreate = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const finalDraft: NewPackDraft = {
        ...draft,
        aiPrompt: aiPrompt.trim() || undefined,
      }

      if (onSubmitDraft) {
        await onSubmitDraft(finalDraft, effectiveRequestSummary)
        onClose()
        return
      }

      const payload = buildNewPackProjectPayload(finalDraft)
      // Include imported score document in metadata if present
      if (importedScoreDocument) {
        payload.metadata = {
          ...payload.metadata,
          scoreDocument: importedScoreDocument,
        }
      }
      const project = await projectService.create(payload)
      upsertProject(project)
      onClose()
      navigate(`/pack/${project.id}`)
    } catch (createError) {
      console.error('Failed to create pack', createError)
      setError(onSubmitDraft ? 'Could not continue with the import. Please try again.' : 'Could not create the project. Please try again.')
    } finally {
      setSubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, aiPrompt, importedScoreDocument, onSubmitDraft, onClose, navigate, upsertProject])

  const handleCreate = useCallback(async () => {
    if (isImportMode) {
      // Import mode uses existing flow
      setSubmitting(true)
      setError(null)
      try {
        if (onSubmitDraft) {
          await onSubmitDraft(draft, effectiveRequestSummary)
          onClose()
          return
        }
        const project = await projectService.create(buildNewPackProjectPayload(draft))
        upsertProject(project)
        onClose()
        navigate(`/pack/${project.id}`)
      } catch (createError) {
        console.error('Failed to create pack', createError)
        setError(onSubmitDraft ? 'Could not continue with the import. Please try again.' : 'Could not create the project. Please try again.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Default mode: if AI prompt is present
    if (aiPrompt.trim()) {
      if (onAiStyleSubmit) {
        onAiStyleSubmit(draft, aiPrompt.trim())
        onClose()
        return
      }
      setAiProcessing(true)
      setAiStageIndex(0)
      return
    }

    // No AI prompt — create immediately
    await performCreate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImportMode, draft, aiPrompt, onAiStyleSubmit, onSubmitDraft, onClose, navigate, upsertProject, performCreate])

  const selectedPlayingStyle = PLAYING_STYLE_OPTIONS.find((option) => option.id === playingStyleId) ?? PLAYING_STYLE_OPTIONS[0]
  const selectedDisplay = DISPLAY_OPTIONS.find((option) => option.value === draft.layout) ?? DISPLAY_OPTIONS[0]
  const selectedDifficulty = DIFFICULTY_OPTIONS.find((option) => option.id === difficultyId) ?? DIFFICULTY_OPTIONS[0]
  const selectedTuning = NEW_PACK_TUNINGS.find((entry) => entry.id === draft.tuning) ?? NEW_PACK_TUNINGS[0]
  const scoreSettingsSummary = `${selectedTuning.label} · ${selectedDisplay.summaryLabel} · ${selectedDifficulty.label}`
  const previewHeaderLabel = formatPreviewTitle(sourceLabel || draft.name, requestSummary)
  const effectiveRequestSummary = isImportMode
    ? [
        requestSummary.trim() || deriveStyleResultLabel(requestSummary),
        `Playing style: ${selectedPlayingStyle.requestLabel}`,
        `Display: ${selectedDisplay.label}`,
        `Difficulty: ${selectedDifficulty.requestLabel}${selectedDifficulty.requestDetail ? ` (${selectedDifficulty.requestDetail})` : ''}`,
        `Tuning: ${selectedTuning.label}`,
      ].join('. ')
    : aiPrompt.trim() || ''
  const canGenerateImportScore = !submitting && previewStatus === 'ready' && Boolean(draft.name.trim())

  // File upload chip status
  const fileChipStatus = importing ? 'importing' as const : importError ? 'error' as const : uploadedFile ? 'imported' as const : 'idle' as const
  const fileChipMessage = importing
    ? 'Parsing file...'
    : importError
      ? 'Could not parse file'
      : (uploadedFileType === 'gp' || uploadedFileType === 'musicxml')
        ? 'Score detected'
        : undefined

  if (!open) return null

  const dialog = (
    <div className="fixed inset-0 z-[2147483647] overflow-y-auto">
      <div className="fixed inset-0 bg-[rgba(0,0,0,0.42)]" onClick={onClose} />
      <div className="relative grid min-h-[100dvh] place-items-center p-4 sm:p-6">

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-pack-dialog-title"
          className="relative isolate flex w-full flex-col overflow-hidden rounded-[28px] border border-[#e9e7e2] bg-[#ffffff] text-[#111111] shadow-[0px_24px_60px_rgba(0,0,0,0.10)]"
          style={{
            width: 'min(780px, calc(100vw - 32px))',
            maxHeight: 'min(720px, calc(100dvh - 32px))',
            backgroundColor: '#ffffff',
            opacity: 1,
          }}
        >
        <div className="flex items-start justify-between gap-4 bg-[#ffffff] px-5 pb-4 pt-5 sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="new-pack-dialog-title" className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-[#111111]">
                {sourceTitle}
              </h2>
              {isImportMode ? (
                <span className="rounded-full bg-[#f3f2ee] px-3 py-1 text-[11px] font-medium text-[#6a6a64]">
                  Step 2 of 3
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#fafafa] text-[#3a3a3a] transition-colors hover:bg-[#f0f0f0]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#ffffff] px-5 pb-3.5 pt-1">
          {isImportMode ? (
            /* ============================================================= */
            /* IMPORT MODE — unchanged from original                         */
            /* ============================================================= */
            <div className="grid gap-4">
              <ImportStageCard
                title="Preview style result"
                status={
                  previewStatus === 'generating' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6a6a64]">
                      <Loader2 size={13} className="animate-spin" />
                      Generating preview
                    </span>
                  ) : previewStatus === 'error' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b24d37]">
                      <AlertCircle size={13} />
                      Preview unavailable
                    </span>
                  ) : null
                }
                error={previewStatus === 'error' ? previewError ?? 'Could not load the style preview.' : null}
              >
                <div className="space-y-2">
                  <p className="min-w-0 truncate text-[14px] font-medium leading-[1.35] text-[#111111]">
                    {previewHeaderLabel}
                  </p>

                  {/* Horizontal scroll-snap version picker */}
                  <div
                    ref={setVersionScrollRef}
                    className="flex snap-x snap-mandatory gap-3 overflow-x-auto"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    {([0, 1] as const).map((versionIdx) => {
                      const isSelected = selectedVersionIndex === versionIdx
                      return (
                        <div
                          key={versionIdx}
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onClick={() => selectVersion(versionIdx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') selectVersion(versionIdx)
                          }}
                          className={cn(
                            'w-[calc(100%-56px)] shrink-0 snap-start cursor-pointer rounded-[20px] px-4 py-3 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2',
                            isSelected
                              ? 'bg-[#111111]'
                              : 'bg-[#f7f6f3] hover:bg-[#f0efe9]',
                          )}
                        >
                          <div className="mb-2.5 flex items-center justify-between">
                            <span className={cn('text-[11px] font-semibold uppercase tracking-[0.06em]', isSelected ? 'text-white/50' : 'text-[#6a6a64]')}>
                              Version {versionIdx + 1}
                            </span>
                            {isSelected && (
                              <span className="text-[11px] font-medium text-white/70">Selected</span>
                            )}
                          </div>
                          <WaveformPlayer
                            ref={versionIdx === 0 ? waveformRef0 : waveformRef1}
                            url={previewAudioUrl}
                            status={previewStatus}
                            isSelected={isSelected}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination dots */}
                  <div className="flex items-center justify-center gap-1.5" role="group" aria-label="Version navigation">
                    {([0, 1] as const).map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        aria-label={`Go to Version ${idx + 1}`}
                        onClick={() => selectVersion(idx)}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-200',
                          selectedVersionIndex === idx
                            ? 'w-4 bg-[#111111]'
                            : 'w-1.5 bg-[#d9d9d9] hover:bg-[#bbbbbb]',
                        )}
                      />
                    ))}
                  </div>

                </div>
              </ImportStageCard>

              <ImportStageCard title="Playing style">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PLAYING_STYLE_OPTIONS.map((option) => {
                    const active = playingStyleId === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPlayingStyleId(option.id)}
                        aria-pressed={active}
                        className={cn(
                          'flex flex-col items-start justify-center rounded-[18px] border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2',
                          active
                            ? 'border-[1.5px] border-[#111111] bg-[#111111]'
                            : 'border-[#e5e5e5] bg-white hover:border-[#d6d6d6] hover:bg-[#faf9f7]',
                        )}
                      >
                        <div className="space-y-0.5">
                          <p className={cn('text-[13px] font-semibold leading-[1.2]', active ? 'text-white' : 'text-[#111111]')}>{option.label}</p>
                          <p className={cn('text-[11px] leading-[1.4]', active ? 'text-[#aaaaaa]' : 'text-[#737373]')}>{option.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ImportStageCard>

              <ImportStageCard title="Score settings">
                <div className="overflow-hidden rounded-[18px] bg-[#f7f6f3]">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f3f1ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-inset"
                    aria-expanded={showAdvancedSettings}
                  >
                    <p className="truncate text-[13px] text-[#555555]">{scoreSettingsSummary}</p>
                    <ChevronDown
                      size={15}
                      className={cn(
                        'shrink-0 text-[#8a8a8a] transition-transform duration-200',
                        showAdvancedSettings && 'rotate-180',
                      )}
                    />
                  </button>

                  {showAdvancedSettings ? (
                    <div className="grid gap-2 px-3 pb-3">
                      <label className="flex flex-col gap-2 rounded-[14px] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="shrink-0 text-[13px] font-medium text-[#555555]">Tuning</span>
                        <div className="sm:w-[220px]">
                          <SelectValue
                            ariaLabel="Tuning"
                            value={draft.tuning}
                            onChange={(value) => updateDraft('tuning', value as NewPackTuningId)}
                            options={NEW_PACK_TUNINGS.map((tuning) => ({
                              value: tuning.id,
                              label: tuning.label,
                            }))}
                          />
                        </div>
                      </label>

                      <label className="flex flex-col gap-2 rounded-[14px] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="shrink-0 text-[13px] font-medium text-[#555555]">Display</span>
                        <div className="sm:w-[220px]">
                          <SelectValue
                            ariaLabel="Display"
                            value={draft.layout}
                            onChange={(value) => updateDraft('layout', value as NewPackLayout)}
                            options={DISPLAY_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                          />
                        </div>
                      </label>

                      <label className="flex flex-col gap-2 rounded-[14px] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="shrink-0 text-[13px] font-medium text-[#555555]">Difficulty</span>
                        <div className="sm:w-[220px]">
                          <SelectValue
                            ariaLabel="Difficulty"
                            value={difficultyId}
                            onChange={(value) => setDifficultyId(value)}
                            options={DIFFICULTY_OPTIONS.map((option) => ({
                              value: option.id,
                              label: option.description,
                            }))}
                          />
                        </div>
                      </label>
                    </div>
                  ) : null}
                </div>
              </ImportStageCard>
            </div>
          ) : aiProcessing ? (
            /* ============================================================= */
            /* AI MOCK PROCESSING STATE                                      */
            /* ============================================================= */
            <AiProcessingOverlay stageIndex={aiStageIndex} stages={AI_PROCESSING_STAGES} />
          ) : (
            /* ============================================================= */
            /* DEFAULT MODE — enhanced with file upload + AI prompt           */
            /* ============================================================= */
            <div className="grid gap-5">
              {/* File upload zone / chip */}
              {uploadedFile && uploadedFileType ? (
                <FileUploadChip
                  fileName={uploadedFile.name}
                  fileCategory={uploadedFileType}
                  status={fileChipStatus}
                  statusMessage={fileChipMessage}
                  onRemove={handleRemoveFile}
                />
              ) : (
                <FileUploadZone
                  onFileSelect={handleFileSelect}
                  disabled={importing}
                />
              )}

              {/* AI prompt */}
              <AiPromptInput
                value={aiPrompt}
                onChange={setAiPrompt}
                disabled={importing}
              />

              {/* Presets + Details grid */}
              <div className="grid gap-5 md:grid-cols-[228px_minmax(0,1fr)]">
                <section>
                  <h3 className="text-[14px] font-semibold text-[#111111]">Preset</h3>
                  <div className="mt-3 grid gap-2.5">
                    {PRESET_OPTIONS.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        active={activePresetId === preset.id}
                        label={preset.label}
                        description={preset.description}
                        onClick={() => handlePresetSelect(preset.id)}
                      />
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-[14px] font-semibold text-[#111111]">Details</h3>
                  <div className="mt-3 grid gap-3">
                    <DetailCard label="Project name">
                      <input
                        aria-label="Project name"
                        value={draft.name}
                        onChange={(event) => updateDraft('name', event.target.value)}
                        placeholder="Untitled Project"
                        className={VALUE_INPUT_CLASS_NAME}
                      />
                    </DetailCard>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailCard label="Bars">
                        <SelectValue
                          ariaLabel="Bars"
                          value={String(draft.bars)}
                          onChange={(value) => updateDraft('bars', Number(value))}
                          options={BAR_OPTIONS.map((bars) => ({ value: String(bars), label: String(bars) }))}
                        />
                      </DetailCard>

                      <DetailCard label="Tempo">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label="Tempo"
                            inputMode="numeric"
                            value={String(draft.tempo)}
                            onChange={(event) =>
                              updateDraft('tempo', clampNumber(event.target.value, 40, 240, draft.tempo))
                            }
                            className={cn(VALUE_INPUT_CLASS_NAME, 'min-w-0')}
                          />
                          <span className="shrink-0 text-[17px] font-medium text-[#3f3f3b]">BPM</span>
                        </div>
                      </DetailCard>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailCard label="Meter">
                        <SelectValue
                          ariaLabel="Meter"
                          value={draft.timeSignature}
                          onChange={(value) => updateDraft('timeSignature', value)}
                          options={TIME_SIGNATURE_OPTIONS.map((option) => ({ value: option, label: option }))}
                        />
                      </DetailCard>

                      <DetailCard label="Key">
                        <SelectValue
                          ariaLabel="Key"
                          value={draft.key}
                          onChange={(value) => updateDraft('key', value)}
                          options={KEY_OPTIONS.map((key) => ({ value: key, label: key }))}
                        />
                      </DetailCard>
                    </div>

                    <DetailCard label="Layout" className="min-h-[88px]">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {LAYOUT_OPTIONS.map((option) => {
                          const active = draft.layout === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updateDraft('layout', option.value)}
                              className={cn(
                                'flex min-h-[44px] items-center justify-center rounded-[14px] border px-3 py-2 text-[13px] font-medium transition-colors',
                                active
                                  ? 'border-[1.5px] border-[#111111] bg-[#f3f3f3] text-[#111111]'
                                  : 'border border-[#e5e5e5] bg-[#ffffff] text-[#111111] hover:border-[#d4d4d4] hover:bg-[#f5f5f5]',
                              )}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </DetailCard>

                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedSettings((current) => !current)}
                        className="inline-flex h-10 items-center justify-between rounded-[16px] bg-[#f7f6f3] px-4 text-left text-[13px] font-medium text-[#333333] transition-colors hover:bg-[#f1f0ec]"
                        aria-expanded={showAdvancedSettings}
                      >
                        <span>More settings</span>
                        <ChevronDown
                          size={16}
                          className={cn(
                            'text-[#8a8a8a] transition-transform duration-200',
                            showAdvancedSettings && 'rotate-180',
                          )}
                        />
                      </button>

                      {showAdvancedSettings ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <DetailCard label="Tuning">
                            <SelectValue
                              ariaLabel="Tuning"
                              value={draft.tuning}
                              onChange={(value) => updateDraft('tuning', value as NewPackTuningId)}
                              options={NEW_PACK_TUNINGS.map((tuning) => ({
                                value: tuning.id,
                                label: tuning.label,
                              }))}
                            />
                          </DetailCard>

                          <DetailCard label="Capo">
                            <input
                              aria-label="Capo"
                              inputMode="numeric"
                              value={String(draft.capo)}
                              onChange={(event) =>
                                updateDraft('capo', clampNumber(event.target.value, 0, 12, draft.capo))
                              }
                              className={VALUE_INPUT_CLASS_NAME}
                            />
                          </DetailCard>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        {/* Footer — hidden during AI processing */}
        {!aiProcessing ? (
          <div className="flex flex-col gap-4 bg-[#ffffff] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-h-10 flex-col items-start justify-center gap-1">
              {isImportMode ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[13px] font-medium text-[#737373] underline-offset-4 transition-colors hover:text-[#111111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
                >
                  Reselect style
                </button>
              ) : (
                <p className="text-[11px] text-[#737373]">Edit later if needed.</p>
              )}
              {error ? <p role="alert" className="text-[11px] text-[#b24d37]" aria-live="polite">{error}</p> : null}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#fafafa] px-5 text-sm font-medium text-[#333333] transition-colors hover:bg-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              {isImportMode ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canGenerateImportScore}
                  className="inline-flex h-10 min-w-[136px] items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-medium text-white transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Generating...' : 'Generate score'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting || importing || !draft.name.trim()}
                  className="inline-flex h-10 min-w-[136px] items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-medium text-white transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'Creating...'
                    : aiPrompt.trim()
                      ? 'Create & stylize'
                      : submitLabel ?? createActionLabel(draft.layout)}
                </button>
              )}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}
