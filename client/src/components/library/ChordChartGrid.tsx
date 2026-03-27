import { cn } from '@/components/ui/utils'
import type { ChordChart } from '@/data/chordCharts'

interface ChordChartGridProps {
  charts: ChordChart[]
  onSelect: (chart: ChordChart) => void
  className?: string
}

export function ChordChartGrid({ charts, onSelect, className }: ChordChartGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2', className)}>
      {charts.map((chart) => (
        <button
          key={chart.id}
          type="button"
          onClick={() => onSelect(chart)}
          className="group flex flex-col gap-3 rounded-md border border-border bg-surface-0 p-4 text-left transition-colors hover:border-border-hover hover:bg-surface-1"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight text-text-primary">{chart.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{chart.artist ?? chart.style}</p>
            </div>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-text-secondary">
              {chart.key}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
            <span>{chart.style}</span>
            <span>·</span>
            <span>Key of {chart.key}</span>
            {chart.tempo ? (
              <>
                <span>·</span>
                <span>{chart.tempo} BPM</span>
              </>
            ) : null}
          </div>

          <span className="text-sm font-medium text-text-secondary transition-colors group-hover:text-text-primary">
            Open chart
          </span>
        </button>
      ))}
    </div>
  )
}
