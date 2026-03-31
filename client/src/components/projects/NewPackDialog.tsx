import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/components/ui/utils'
import { projectService } from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'
import {
  buildNewPackProjectPayload,
  NEW_PACK_PRESETS,
  NEW_PACK_TUNINGS,
  type NewPackDraft,
  type NewPackLayout,
  type NewPackPreset,
  type NewPackTuningId,
} from '@/spaces/pack/newPack'

interface NewPackDialogProps {
  open: boolean
  onClose: () => void
}

const BAR_OPTIONS = [8, 12, 16, 32, 64]
const KEY_OPTIONS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Am', 'Em']
const LAYOUT_OPTIONS: Array<{ value: NewPackLayout; label: string }> = [
  { value: 'split', label: 'Score + Tab' },
  { value: 'tab', label: 'Tab only' },
  { value: 'staff', label: 'Standard only' },
]

const DEFAULT_DRAFT: NewPackDraft = {
  name: 'Untitled Pack',
  bars: 32,
  tempo: 92,
  timeSignature: '4/4',
  key: 'C',
  layout: 'split',
  tuning: 'standard',
  capo: 0,
}

function applyPresetToDraft(preset: NewPackPreset): NewPackDraft {
  return {
    ...DEFAULT_DRAFT,
    name: preset.label,
    bars: preset.bars,
    tempo: preset.tempo,
    timeSignature: preset.timeSignature,
    layout: preset.layout,
    tuning: preset.tuning,
  }
}

export function NewPackDialog({ open, onClose }: NewPackDialogProps) {
  const navigate = useNavigate()
  const upsertProject = useProjectStore((state) => state.upsertProject)
  const [draft, setDraft] = useState<NewPackDraft>(DEFAULT_DRAFT)
  const [activePresetId, setActivePresetId] = useState<string>('practice-32')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateDraft = <K extends keyof NewPackDraft>(key: K, value: NewPackDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handlePresetSelect = (preset: NewPackPreset) => {
    setActivePresetId(preset.id)
    setDraft((current) => ({
      ...applyPresetToDraft(preset),
      name: current.name === DEFAULT_DRAFT.name || current.name === NEW_PACK_PRESETS.find((entry) => entry.id === activePresetId)?.label
        ? preset.label
        : current.name,
      key: current.key,
      capo: current.capo,
    }))
  }

  const handleCreate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const project = await projectService.create(buildNewPackProjectPayload(draft))
      upsertProject(project)
      onClose()
      navigate(`/pack/${project.id}`)
    } catch (createError) {
      console.error('Failed to create pack', createError)
      setError('Could not create the new pack. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create New Pack" className="max-w-2xl p-0">
      <div className="grid gap-0 md:grid-cols-[1fr_0.95fr]">
        <div className="border-b border-border p-5 md:border-b-0 md:border-r">
          <div className="grid gap-3">
            {NEW_PACK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  'rounded-2xl border p-3 text-left transition-colors',
                  activePresetId === preset.id ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover hover:bg-surface-1',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-text-primary">{preset.label}</p>
                  <div className="rounded-xl bg-surface-1 px-3 py-2 text-right">
                    <p className="text-xs uppercase tracking-[0.12em] text-text-muted">{preset.bars} bars</p>
                    <p className="mt-1 text-sm text-text-primary">{preset.timeSignature}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4">
            <Input
              label="Pack name"
              value={draft.name}
              onChange={(event) => updateDraft('name', event.target.value)}
              placeholder="Untitled Pack"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-primary">Bars</span>
                <div className="flex flex-wrap gap-2">
                  {BAR_OPTIONS.map((bars) => (
                    <button
                      key={bars}
                      type="button"
                      onClick={() => updateDraft('bars', bars)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-sm transition-colors',
                        draft.bars === bars ? 'border-accent bg-accent/5 text-text-primary' : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
                      )}
                    >
                      {bars}
                    </button>
                  ))}
                </div>
              </label>

              <Input
                label="Tempo"
                value={String(draft.tempo)}
                onChange={(event) => updateDraft('tempo', Math.max(40, Math.min(240, Number(event.target.value) || 120)))}
                inputMode="numeric"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-primary">Time signature</span>
                <select
                  value={draft.timeSignature}
                  onChange={(event) => updateDraft('timeSignature', event.target.value)}
                  className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text-primary outline-none focus:border-border-hover"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                  <option value="12/8">12/8</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-primary">Key</span>
                <select
                  value={draft.key}
                  onChange={(event) => updateDraft('key', event.target.value)}
                  className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text-primary outline-none focus:border-border-hover"
                >
                  {KEY_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <p className="text-sm font-medium text-text-primary">Layout</p>
              <div className="mt-2 grid gap-2">
                {LAYOUT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateDraft('layout', option.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition-colors',
                      draft.layout === option.value ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover hover:bg-surface-1',
                    )}
                  >
                    <p className="text-sm font-medium text-text-primary">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-primary">Tuning</span>
                <select
                  value={draft.tuning}
                  onChange={(event) => updateDraft('tuning', event.target.value as NewPackTuningId)}
                  className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text-primary outline-none focus:border-border-hover"
                >
                  {NEW_PACK_TUNINGS.map((tuning) => (
                    <option key={tuning.id} value={tuning.id}>
                      {tuning.label}
                    </option>
                  ))}
                </select>
              </label>

              <Input
                label="Capo"
                value={String(draft.capo)}
                onChange={(event) => updateDraft('capo', Math.min(12, Math.max(0, Number(event.target.value) || 0)))}
                inputMode="numeric"
              />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreate} disabled={submitting || !draft.name.trim()}>
                {submitting ? 'Creating...' : 'Create Pack'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
