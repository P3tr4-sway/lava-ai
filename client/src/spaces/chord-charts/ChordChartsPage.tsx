import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileMusic } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CHORD_CHARTS } from '@/data/chordCharts'
import { ChordChartGrid } from '@/components/library/ChordChartGrid'

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

        <ChordChartGrid charts={CHORD_CHARTS} onSelect={(chart) => navigate(`/learn/songs/${chart.id}`)} />

      </div>
    </div>
  )
}
