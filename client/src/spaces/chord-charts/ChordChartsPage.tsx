import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileMusic } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CHORD_CHARTS } from '@/data/chordCharts'

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ChordChartsPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FileMusic size={20} className="text-text-secondary" />
              <h1 className="text-xl font-semibold text-text-primary">Chord Charts</h1>
            </div>
            <p className="text-sm text-text-muted">Browse chord progressions and start learning.</p>
          </div>
          <Button onClick={() => navigate('/learn')} className="gap-2">
            <ArrowLeft size={14} />
            Back to Learn
          </Button>
        </div>

        {/* Chart Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {CHORD_CHARTS.map((chart) => (
            <button
              key={chart.id}
              onClick={() => navigate(`/score/${chart.id}`)}
              className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden text-left transition-colors group"
            >
              {/* Album Art — black mockup */}
              <div className="aspect-square w-full bg-surface-2 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-text-muted text-xs font-mono tracking-widest uppercase mb-2">{chart.style}</p>
                  <p className="text-text-primary text-2xl font-bold">{chart.key}</p>
                </div>
              </div>
              {/* Info */}
              <div className="flex flex-col gap-2 p-6">
                <p className="text-base font-semibold text-text-primary leading-tight">{chart.title}</p>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span>{chart.style}</span>
                  <span>·</span>
                  <span>Key of {chart.key}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
