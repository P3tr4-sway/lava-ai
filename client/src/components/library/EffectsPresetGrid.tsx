import { cn } from '@/components/ui/utils'
import type { EffectsPreset } from '@/data/effectsPresets'

interface EffectsPresetGridProps {
  presets: EffectsPreset[]
  onSelect: (preset: EffectsPreset) => void
  className?: string
}

export function EffectsPresetGrid({ presets, onSelect, className }: EffectsPresetGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2', className)}>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelect(preset)}
          className="group flex flex-col gap-3 rounded-md border border-border bg-surface-0 p-4 text-left transition-colors hover:border-border-hover hover:bg-surface-1"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight text-text-primary">{preset.name}</p>
              <p className="mt-1 text-sm text-text-secondary">{preset.description}</p>
            </div>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-text-secondary">
              Preset
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
            <span>{preset.style}</span>
            <span>·</span>
            <span>{preset.chain.length} modules</span>
          </div>

          <p className="text-sm text-text-secondary">{preset.chain.join(' · ')}</p>

          <span className="text-sm font-medium text-text-secondary transition-colors group-hover:text-text-primary">
            Open in Tone
          </span>
        </button>
      ))}
    </div>
  )
}
