import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, X } from 'lucide-react'
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

interface NewPackDialogProps {
  open: boolean
  onClose: () => void
  mode?: 'default' | 'import'
  initialDraft?: NewPackDraft | null
  sourceLabel?: string
  detectedFields?: Array<{ label: string; value: string }>
  submitLabel?: string
  onSubmitDraft?: (draft: NewPackDraft) => Promise<void> | void
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
  { value: 'staff', label: 'Lead sheet' },
]

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'standard-guitar',
    label: 'Standard Guitar',
    description: 'Tabs for strumming.',
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
    id: 'lead-sheet',
    label: 'Lead Sheet',
    description: 'Staff + chords.',
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
    id: 'fingerstyle-solo',
    label: 'Fingerstyle / Solo',
    description: 'Melody + tabs.',
    draft: {
      bars: 16,
      tempo: 72,
      timeSignature: '4/4',
      key: 'C',
      layout: 'split',
      tuning: 'dadgad',
      capo: 0,
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Start blank.',
    draft: {
      bars: 8,
      tempo: 120,
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
  name: 'Untitled Pack',
  ...PRESET_OPTIONS[0].draft,
}

const CARD_CLASS_NAME =
  'rounded-2xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-left'

const VALUE_INPUT_CLASS_NAME =
  'w-full border-0 bg-transparent p-0 text-[16px] font-medium leading-[1.2] text-[#111111] outline-none placeholder:text-[#a3a3a3]'

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
  return layout === 'tab' ? 'Create tab' : 'Create pack'
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
  sourceLabel,
  detectedFields = [],
  submitLabel,
  onSubmitDraft,
}: NewPackDialogProps) {
  const navigate = useNavigate()
  const upsertProject = useProjectStore((state) => state.upsertProject)
  const [draft, setDraft] = useState<NewPackDraft>(DEFAULT_DRAFT)
  const [activePresetId, setActivePresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isImportMode = mode === 'import'

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    setDraft(initialDraft ?? resetDraft())
    setActivePresetId(initialDraft ? 'custom' : DEFAULT_PRESET_ID)
    setSubmitting(false)
    setError(null)
  }, [initialDraft, open])

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

  const handleCreate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (onSubmitDraft) {
        await onSubmitDraft(draft)
        onClose()
        return
      }
      const project = await projectService.create(buildNewPackProjectPayload(draft))
      upsertProject(project)
      onClose()
      navigate(`/pack/${project.id}`)
    } catch (createError) {
      console.error('Failed to create pack', createError)
      setError(onSubmitDraft ? 'Could not continue with the import. Please try again.' : 'Could not create the new pack. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const dialog = (
    <div className="fixed inset-0 z-[2147483647] overflow-y-auto">
      <div className="fixed inset-0 bg-[rgba(0,0,0,0.42)]" onClick={onClose} />
      <div className="relative flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6 lg:justify-end lg:pl-[224px] lg:pr-10">

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-pack-dialog-title"
          className="relative isolate my-6 flex w-full flex-col overflow-hidden rounded-[28px] border border-[#e5e5e5] bg-[#f5f5f5] text-[#111111] shadow-[0px_28px_70px_rgba(0,0,0,0.14)] ring-1 ring-[rgba(255,255,255,0.55)]"
          style={{
            width: 'min(860px, calc(100vw - 32px))',
            maxHeight: 'min(720px, calc(100vh - 32px))',
            backgroundColor: '#f5f5f5',
            opacity: 1,
          }}
        >
        <div className="flex items-start justify-between gap-4 bg-[#f5f5f5] px-5 pb-3 pt-5 sm:items-center">
          <div>
            <h2 id="new-pack-dialog-title" className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-[#111111]">
              {isImportMode ? 'Add score options' : 'Add guitar score'}
            </h2>
            <p className="mt-1.5 text-[12px] text-[#737373]">
              {isImportMode ? 'Review what we found, then confirm the pack settings.' : 'Choose, tweak, create.'}
            </p>
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

        <div className="mx-5 h-px bg-[#e2e2e2]" />

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] px-5 py-3.5">
          <div className={cn('grid gap-4 md:gap-0', isImportMode ? 'md:grid-cols-[264px_minmax(0,1fr)]' : 'md:grid-cols-[228px_minmax(0,1fr)]')}>
            <section className="md:border-r md:border-[#e2e2e2] md:pr-4">
              {isImportMode ? (
                <>
                  <h3 className="text-[14px] font-semibold text-[#111111]">Detected</h3>
                  <div className="mt-3 grid gap-2.5">
                    <section className={cn(CARD_CLASS_NAME, 'flex flex-col gap-2')}>
                      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#737373]">Source</p>
                      <p className="text-[15px] font-medium leading-[1.35] text-[#111111]">
                        {sourceLabel || draft.name}
                      </p>
                      <p className="text-[11px] leading-[1.35] text-[#8a8a8a]">
                        Key, meter, and tempo were prefilled from the uploaded source.
                      </p>
                    </section>
                    {detectedFields.map((field) => (
                      <section key={field.label} className={cn(CARD_CLASS_NAME, 'flex min-h-[72px] flex-col gap-1.5')}>
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#737373]">{field.label}</p>
                        <p className="text-[16px] font-medium leading-[1.2] text-[#111111]">{field.value}</p>
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </section>

            <section className="md:pl-5">
              <h3 className="text-[14px] font-semibold text-[#111111]">Details</h3>

              <div className="mt-3 grid gap-3">
                <DetailCard label="Project name">
                  <input
                    aria-label="Project name"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder="Untitled Pack"
                    className={VALUE_INPUT_CLASS_NAME}
                  />
                </DetailCard>

                {isImportMode ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DetailCard label="Key">
                      <p className="text-[17px] font-medium leading-[1.2] text-[#111111]">{draft.key}</p>
                    </DetailCard>
                    <DetailCard label="Meter">
                      <p className="text-[17px] font-medium leading-[1.2] text-[#111111]">{draft.timeSignature}</p>
                    </DetailCard>
                    <DetailCard label="Tempo">
                      <p className="text-[17px] font-medium leading-[1.2] text-[#111111]">{draft.tempo} BPM</p>
                    </DetailCard>
                  </div>
                ) : (
                  <>
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
                  </>
                )}

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
              </div>
            </section>
          </div>
        </div>

        <div className="mx-5 h-px bg-[#e2e2e2]" />

        <div className="flex flex-col gap-4 bg-[#f5f5f5] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] text-[#737373]">Edit later if needed.</p>
            {error ? <p className="text-[11px] text-[#b24d37]">{error}</p> : null}
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
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !draft.name.trim()}
              className="inline-flex h-10 min-w-[136px] items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-medium text-white transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating...' : submitLabel ?? (isImportMode ? 'Create Pack' : createActionLabel(draft.layout))}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}
