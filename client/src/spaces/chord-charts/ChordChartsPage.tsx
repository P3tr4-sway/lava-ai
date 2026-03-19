import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileMusic } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// ─── Mock data ────────────────────────────────────────────────────────────────

const CHORD_CHARTS = [
  { id: '1', title: 'Autumn Leaves', style: 'Jazz Standard', key: 'Gm' },
  { id: '2', title: '12 Bar Blues', style: 'Blues', key: 'A' },
  { id: '3', title: 'ii-V-I Progressions', style: 'Jazz', key: 'C' },
  { id: '4', title: 'Canon in D', style: 'Classical', key: 'D' },
  { id: '5', title: 'Rhythm Changes', style: 'Jazz', key: 'Bb' },
  { id: '6', title: 'Minor Swing', style: 'Gypsy Jazz', key: 'Am' },
  { id: '7', title: 'Bossa Nova Basics', style: 'Bossa Nova', key: 'Dm' },
  { id: '8', title: 'Pop Punk Essentials', style: 'Pop Punk', key: 'G' },
  { id: '9', title: 'Soul Progressions', style: 'Soul', key: 'F' },
]

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
              onClick={() => navigate('/learn')}
              className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden text-left transition-colors group"
            >
              {/* Album Art — black mockup */}
              <div className="aspect-square w-full bg-black flex items-center justify-center">
                <div className="text-center">
                  <p className="text-white/60 text-xs font-mono tracking-widest uppercase mb-2">{chart.style}</p>
                  <p className="text-white text-2xl font-bold">{chart.key}</p>
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
