import { useState, useEffect } from 'react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui/Button'
import type { Technique } from '@lava/shared'
import type { TechniqueDef, TechniqueParamDef } from '@/spaces/pack/editor-core/techniqueDefinitions'

interface TechniquePanelProps {
  def: TechniqueDef
  activeTechnique: Technique | undefined
  onApply: (technique: Technique) => void
  onRemove: (type: string) => void
  className?: string
}

function getIcon(name: string) {
  return (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? LucideIcons.HelpCircle
}

export function TechniquePanel({ def, activeTechnique, onApply, onRemove, className }: TechniquePanelProps) {
  const isActive = !!activeTechnique
  const [params, setParams] = useState<Record<string, string | number>>(() => {
    const defaults: Record<string, string | number> = {}
    for (const p of def.params) {
      defaults[p.key] = activeTechnique ? (activeTechnique as Record<string, unknown>)[p.key] as (string | number) ?? p.default : p.default
    }
    return defaults
  })

  useEffect(() => {
    const next: Record<string, string | number> = {}
    for (const p of def.params) {
      next[p.key] = activeTechnique
        ? ((activeTechnique as Record<string, unknown>)[p.key] as string | number) ?? p.default
        : p.default
    }
    setParams(next)
  }, [activeTechnique, def])

  const Icon = getIcon(def.icon)

  function handleToggle() {
    if (isActive) {
      onRemove(def.type)
    } else {
      const technique = { type: def.type, ...params } as unknown as Technique
      onApply(technique)
    }
  }

  function handleParamChange(key: string, value: string | number) {
    const next = { ...params, [key]: value }
    setParams(next)
    if (isActive) {
      const technique = { type: def.type, ...next } as unknown as Technique
      onApply(technique)
    }
  }

  if (def.params.length === 0) {
    return (
      <Button
        variant={isActive ? 'default' : 'ghost'}
        size="icon-sm"
        onClick={handleToggle}
        className={className}
        title={def.label}
      >
        <Icon className="size-4" />
      </Button>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button
        variant={isActive ? 'default' : 'ghost'}
        size="sm"
        onClick={handleToggle}
        className="gap-1.5"
      >
        <Icon className="size-4" />
        <span className="text-xs">{def.label}</span>
      </Button>
      {def.params.map((p) => (
        <ParamControl key={p.key} param={p} value={params[p.key]!} onChange={(v) => handleParamChange(p.key, v)} />
      ))}
    </div>
  )
}

function ParamControl({ param, value, onChange }: { param: TechniqueParamDef; value: string | number; onChange: (v: string | number) => void }) {
  if (param.kind === 'select') {
    return (
      <select
        className="rounded bg-surface-2 border border-border px-1.5 py-0.5 text-xs text-text-primary"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      >
        {param.options!.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      type="number"
      className="w-16 rounded bg-surface-2 border border-border px-1.5 py-0.5 text-xs text-text-primary"
      min={param.min}
      max={param.max}
      step={param.step}
      value={value as number}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}
