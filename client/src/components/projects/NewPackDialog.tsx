import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronDown, FileAudio, FileMusic, FileText, Guitar, Hand, Loader2, Music2, Pause, Play, RefreshCw, Sliders, X, Zap } from 'lucide-react'
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

type ImportSourceKind = 'audio' | 'youtube' | 'musicxml' | 'pdf-image'
type ImportPhase = 'confirm-source' | 'pick-style'

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
  previewVersionLabel?: string
  previewStatus?: 'ready' | 'generating' | 'error'
  previewError?: string | null
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

const STYLE_OPTIONS = [
  { id: 'fingerstyle', icon: Guitar, label: 'Fingerstyle', prompt: 'Create a fingerstyle version' },
  { id: 'blues', icon: Music2, label: 'Blues', prompt: 'Create a blues arrangement' },
  { id: 'fresh-cover', icon: RefreshCw, label: 'Fresh cover', prompt: 'Create a fresh cover arrangement' },
  { id: 'simplify', icon: Sliders, label: 'Simplify', prompt: 'Simplify this song' },
  { id: 'open-chords', icon: Hand, label: 'Open chords', prompt: 'Use only open chords' },
  { id: 'solo', icon: Zap, label: 'Solo', prompt: 'Turn into a guitar solo' },
] as const

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'simplified-practice',
    label: 'Simplified Practice',
    description: 'Easier tabs for practice.',
    draft: {
      bars: 32,
      tempo: 92,
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
    id: 'fingerstyle-arrangement',
    label: 'Fingerstyle Arrangement',
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
  {
    id: 'blank-setup',
    label: 'Blank Setup',
    description: 'Choose everything yourself.',
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
const PREVIEW_DURATION_SECONDS = 12

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
    <section className="space-y-4">
        <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[19px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#111111]">{title}</h4>
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

export function NewPackDialog({
  open,
  onClose,
  mode = 'default',
  initialDraft,
  initialRequestSummary,
  sourceLabel,
  importSource,
  detectedFields = [],
  submitLabel,
  onSubmitDraft,
  previewVersionLabel,
  previewStatus = 'ready',
  previewError = null,
  onRegeneratePreview,
}: NewPackDialogProps) {
  const navigate = useNavigate()
  const upsertProject = useProjectStore((state) => state.upsertProject)
  const [draft, setDraft] = useState<NewPackDraft>(DEFAULT_DRAFT)
  const [activePresetId, setActivePresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [requestSummary, setRequestSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [regeneratingPreview, setRegeneratingPreview] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null)
  const [importPhase, setImportPhase] = useState<ImportPhase>('confirm-source')
  const isImportMode = mode === 'import'

  const sourceIcon = importSource === 'audio' || importSource === 'youtube'
    ? FileAudio
    : importSource === 'musicxml'
      ? FileMusic
      : importSource === 'pdf-image'
        ? FileText
        : FileAudio

  const sourceTitle = isImportMode
    ? importSource === 'audio' || importSource === 'youtube'
      ? 'Style this audio'
      : 'Style this score'
    : 'Create a guitar project'

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    setDraft(initialDraft ?? resetDraft())
    setActivePresetId(initialDraft ? 'blank-setup' : DEFAULT_PRESET_ID)
    setRequestSummary(initialRequestSummary ?? '')
    setSubmitting(false)
    setError(null)
    setShowAdvancedSettings(false)
    setRegeneratingPreview(false)
    setIsPreviewPlaying(false)
    setPreviewProgress(0)
    setActiveStyleId(null)
    setImportPhase('confirm-source')
  }, [initialDraft, initialRequestSummary, open])

  useEffect(() => {
    if (!isImportMode || !isPreviewPlaying) return
    const tickMs = 250
    const timer = window.setInterval(() => {
      setPreviewProgress((current) => {
        const next = current + tickMs / 1000
        if (next >= PREVIEW_DURATION_SECONDS) {
          window.clearInterval(timer)
          setIsPreviewPlaying(false)
          return 0
        }
        return next
      })
    }, tickMs)

    return () => window.clearInterval(timer)
  }, [isImportMode, isPreviewPlaying])

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

  const handleStyleSelect = (styleId: string, prompt: string) => {
    if (activeStyleId === styleId) {
      setActiveStyleId(null)
      setRequestSummary('')
    } else {
      setActiveStyleId(styleId)
      setRequestSummary(prompt)
    }
  }

  const handleCreate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (onSubmitDraft) {
        await onSubmitDraft(draft, requestSummary.trim())
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
  }

  const summaryFields = useMemo(() => {
    const fallbackFields = [
      { label: 'Key', value: draft.key },
      { label: 'Meter', value: draft.timeSignature },
      { label: 'Tempo', value: `${draft.tempo} BPM` },
    ]

    return detectedFields.length > 0 ? detectedFields : fallbackFields
  }, [detectedFields, draft.key, draft.tempo, draft.timeSignature])

  const resolvedPreviewStatus = regeneratingPreview ? 'generating' : previewStatus
  const canRegeneratePreview = Boolean(onRegeneratePreview) && !regeneratingPreview && !submitting

  const handleRegeneratePreview = useCallback(async () => {
    if (!onRegeneratePreview || regeneratingPreview || submitting) return
    setRegeneratingPreview(true)
    setError(null)
    setIsPreviewPlaying(false)
    setPreviewProgress(0)
    try {
      await onRegeneratePreview()
    } catch (regenerateError) {
      console.error('Failed to regenerate import preview', regenerateError)
      setError('Could not regenerate the style preview. Please try again.')
    } finally {
      setRegeneratingPreview(false)
    }
  }, [onRegeneratePreview, regeneratingPreview, submitting])

  const handleTogglePreviewPlayback = useCallback(() => {
    if (resolvedPreviewStatus !== 'ready' || regeneratingPreview) return
    setIsPreviewPlaying((current) => {
      if (current) return false
      setPreviewProgress((progress) => (progress >= PREVIEW_DURATION_SECONDS ? 0 : progress))
      return true
    })
  }, [regeneratingPreview, resolvedPreviewStatus])

  const previewProgressPercent = Math.min(100, (previewProgress / PREVIEW_DURATION_SECONDS) * 100)
  const currentPreviewSeconds = Math.floor(previewProgress)
  const previewTimeLabel = `00:${currentPreviewSeconds.toString().padStart(2, '0')}`
  const previewDurationLabel = `00:${PREVIEW_DURATION_SECONDS.toString().padStart(2, '0')}`

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

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#ffffff] px-5 pb-3.5 pt-1">
          {isImportMode && importPhase === 'confirm-source' ? (
            <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
              <section>
                <h3 className="text-[14px] font-semibold text-[#111111]">Source</h3>
                <section className="mt-3 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#737373]">Source</p>
                    <div className="flex items-center gap-2">
                      {(() => { const Icon = sourceIcon; return <Icon className="size-4 text-[#737373]" /> })()}
                      <p className="truncate text-[15px] font-medium leading-[1.35] text-[#111111]">
                        {sourceLabel || draft.name}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {summaryFields.map((field) => (
                      <div key={field.label} className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#8a8a84]">
                          {field.label}
                        </p>
                        <p className="text-[15px] font-medium leading-[1.25] text-[#111111]">
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </section>

              <section>
                <h3 className="text-[14px] font-semibold text-[#111111]">Review</h3>
                <div className="mt-3 grid gap-3">
                  <ImportStageCard
                    title="Audio preview"
                    status={
                      resolvedPreviewStatus === 'generating' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6a6a64]">
                          <Loader2 size={13} className="animate-spin" />
                          Generating
                        </span>
                      ) : resolvedPreviewStatus === 'error' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b24d37]">
                          <AlertCircle size={13} />
                          Retry needed
                        </span>
                      ) : null
                    }
                    error={!regeneratingPreview && resolvedPreviewStatus === 'error' ? previewError : null}
                    action={
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTogglePreviewPlayback}
                          disabled={resolvedPreviewStatus !== 'ready'}
                          aria-label={isPreviewPlaying ? 'Pause audio preview' : 'Play audio preview'}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] text-white transition-opacity hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isPreviewPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleRegeneratePreview}
                          disabled={!canRegeneratePreview}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#dfddd7] bg-white px-4 text-[13px] font-medium text-[#222222] transition-colors hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {regeneratingPreview ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                          {regeneratingPreview ? 'Regenerating...' : 'Regenerate'}
                        </button>
                      </div>
                    }
                  >
                    <div className="space-y-3">
                      {previewVersionLabel ? <p className="text-[15px] font-medium text-[#111111]">{previewVersionLabel}</p> : null}
                      <div className="flex items-end gap-1.5" aria-hidden="true">
                        {[18, 26, 14, 32, 20, 28, 12, 22, 16, 30, 18, 24].map((height, index) => (
                          <span
                            key={`${height}-${index}`}
                            className={cn(
                              'w-full rounded-full bg-[#d7d5cf] transition-opacity',
                              resolvedPreviewStatus === 'generating' && 'animate-pulse',
                            )}
                            style={{ height }}
                          />
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-1 rounded-full bg-[#ece9e2]">
                          <div
                            className="h-full rounded-full bg-[#111111] transition-[width] duration-200"
                            style={{ width: `${previewProgressPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#7b7b75]">
                          <span>{previewTimeLabel}</span>
                          <span>{previewDurationLabel}</span>
                        </div>
                      </div>
                    </div>
                  </ImportStageCard>
                </div>
              </section>
            </div>
          ) : isImportMode && importPhase === 'pick-style' ? (
            <div>
              <button
                type="button"
                onClick={() => setImportPhase('confirm-source')}
                className="mb-3 inline-flex items-center gap-1 text-[13px] text-[#737373] transition-colors hover:text-[#111111]"
              >
                &larr; Back to source
              </button>
              <div className="grid gap-3">
                <ImportStageCard title="Style direction">
                  <div className="flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map((option) => {
                      const active = activeStyleId === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleStyleSelect(option.id, option.prompt)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all',
                            active
                              ? 'border-[#111111] bg-[#111111] text-white'
                              : 'border-[#e5e5e5] bg-[#fafafa] text-[#555555] hover:border-[#d4d4d4] hover:bg-[#f5f5f5] hover:text-[#111111]',
                          )}
                        >
                          <option.icon className="size-3.5" />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  <DetailCard
                    label="Or describe your own"
                    helper="Optional"
                    className="mt-3 min-h-[100px] gap-2 px-4 py-3"
                  >
                    <textarea
                      aria-label="Style prompt"
                      value={requestSummary}
                      onChange={(event) => {
                        setRequestSummary(event.target.value)
                        if (event.target.value.trim()) setActiveStyleId(null)
                      }}
                      placeholder="Describe the style you want..."
                      rows={2}
                      className={cn(
                        VALUE_INPUT_CLASS_NAME,
                        'min-h-[56px] resize-none leading-[1.5] placeholder:text-[#a3a3a3]',
                      )}
                    />
                  </DetailCard>
                </ImportStageCard>

                <ImportStageCard title="Score info">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DetailCard label="Key">
                      <SelectValue
                        ariaLabel="Key"
                        value={draft.key}
                        onChange={(value) => updateDraft('key', value)}
                        options={KEY_OPTIONS.map((key) => ({ value: key, label: key }))}
                      />
                    </DetailCard>
                    <DetailCard label="Meter">
                      <SelectValue
                        ariaLabel="Meter"
                        value={draft.timeSignature}
                        onChange={(value) => updateDraft('timeSignature', value)}
                        options={TIME_SIGNATURE_OPTIONS.map((option) => ({ value: option, label: option }))}
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
                </ImportStageCard>

                <DetailCard label="Project name">
                  <input
                    aria-label="Project name"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder="Untitled Project"
                    className={VALUE_INPUT_CLASS_NAME}
                  />
                </DetailCard>

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
            </div>
          ) : !isImportMode ? (
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
          ) : null}
        </div>

        <div className="flex flex-col gap-4 bg-[#ffffff] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] text-[#737373]">{isImportMode ? 'You can still edit the score after this step.' : 'Edit later if needed.'}</p>
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
            {isImportMode && importPhase === 'confirm-source' ? (
              <button
                type="button"
                onClick={() => setImportPhase('pick-style')}
                className="inline-flex h-10 min-w-[136px] items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-medium text-white transition-opacity hover:opacity-92"
              >
                Choose a style
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting || !draft.name.trim()}
                className="inline-flex h-10 min-w-[136px] items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-medium text-white transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Creating...' : submitLabel ?? (isImportMode ? 'Build score' : createActionLabel(draft.layout))}
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}
