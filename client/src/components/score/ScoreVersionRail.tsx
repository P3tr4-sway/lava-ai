import type { PlayableArrangement } from '@lava/shared'
import { cn } from '@/components/ui/utils'

interface ScoreVersionRailProps {
  arrangements: PlayableArrangement[]
  selectedArrangementId: string
  onSelect: (id: PlayableArrangement['id']) => void
  className?: string
}

export function ScoreVersionRail({
  arrangements,
  selectedArrangementId,
  onSelect,
  className,
}: ScoreVersionRailProps) {
  const active = arrangements.find((arrangement) => arrangement.id === selectedArrangementId) ?? arrangements[0]

  if (!active || arrangements.length <= 1) return null

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {arrangements.map((arrangement) => {
          const isActive = arrangement.id === selectedArrangementId
          return (
            <button
              key={arrangement.id}
              onClick={() => onSelect(arrangement.id)}
              className={cn(
                'min-w-[150px] shrink-0 rounded-xl border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-text-primary/25 bg-surface-1 shadow-sm'
                  : 'border-border bg-surface-0 hover:border-border-hover hover:bg-surface-1',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{arrangement.label}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{arrangement.subtitle}</p>
                </div>
                {arrangement.recommended && (
                  <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    Rec
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-2">
        <span className="text-xs font-medium text-text-secondary">What changed</span>
        {active.changeSummary.slice(0, 3).map((change) => (
          <span
            key={change}
            className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-primary"
          >
            {change}
          </span>
        ))}
      </div>
    </div>
  )
}
