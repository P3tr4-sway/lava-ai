import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { Upload, Music, ChevronDown, Check, Play, Pause, RotateCcw } from 'lucide-react'
import { cn } from '@/components/ui/utils'

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_SCORE = {
  title: 'Anjo De Mim',
  artist: 'O Rappa',
  key: 'E minor',
  tempo: 92,
  timeSignature: '4/4',
  tuning: 'Standard',
  pdfUrl: '/scores/anjo-de-mim.pdf',
}

const PARTS = [
  { id: 'lead', label: 'Lead Guitar' },
  { id: 'rhythm', label: 'Rhythm Guitar' },
  { id: 'bass', label: 'Bass Line' },
]

const PROGRESS_SECTIONS = [
  { id: 1, label: 'Intro', status: 'done' as const, accuracy: 96 },
  { id: 2, label: 'Verse 1', status: 'done' as const, accuracy: 88 },
  { id: 3, label: 'Chorus', status: 'current' as const, accuracy: 71 },
  { id: 4, label: 'Verse 2', status: 'locked' as const, accuracy: 0 },
  { id: 5, label: 'Bridge', status: 'locked' as const, accuracy: 0 },
  { id: 6, label: 'Outro', status: 'locked' as const, accuracy: 0 },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export function LearnPage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const [selectedPart, setSelectedPart] = useState('lead')
  const [partsOpen, setPartsOpen] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn', projectId: id })
  }, [id, setSpaceContext])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-5 md:px-6 flex flex-col gap-5 pb-12">

        {/* ── Upload ──────────────────────────────────────────── */}
        <div className="border border-dashed border-border hover:border-border-hover rounded-lg px-5 py-4 flex items-center gap-4 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center group-hover:bg-surface-4 transition-colors shrink-0">
            <Upload size={16} className="text-text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">Upload audio or sheet music</p>
            <p className="text-2xs text-text-muted mt-0.5">MP3, WAV, MIDI, MusicXML, PDF</p>
          </div>
          <button className="shrink-0 text-xs font-medium text-text-muted border border-border rounded px-2.5 py-1 hover:bg-surface-3 hover:border-border-hover transition-colors">
            Browse
          </button>
        </div>

        {/* ── Score + Part selector ───────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Score header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Music size={15} className="text-text-muted" />
              <h2 className="text-sm font-semibold text-text-primary">{MOCK_SCORE.title}</h2>
              <span className="text-2xs text-text-muted">{MOCK_SCORE.artist}</span>
            </div>
            <div className="flex items-center gap-3 text-2xs text-text-muted font-mono">
              <span>{MOCK_SCORE.tuning}</span>
              <span>{MOCK_SCORE.key}</span>
              <span>{MOCK_SCORE.timeSignature}</span>
              <span>♩ = {MOCK_SCORE.tempo}</span>
            </div>
          </div>

          {/* Score display */}
          <div className="bg-surface-0 border border-border rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <button
                onClick={() => setPlaying(!playing)}
                className="w-7 h-7 rounded-full bg-text-primary text-surface-0 flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
              </button>
              <button className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors">
                <RotateCcw size={13} />
              </button>

              <div className="flex-1" />

              {/* Part selector */}
              <div className="relative">
                <button
                  onClick={() => setPartsOpen(!partsOpen)}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-secondary border border-border rounded px-2.5 py-1 hover:bg-surface-3 transition-colors"
                >
                  {PARTS.find((p) => p.id === selectedPart)?.label}
                  <ChevronDown size={12} className={cn('transition-transform', partsOpen && 'rotate-180')} />
                </button>
                {partsOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-surface-0 border border-border rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                    {PARTS.map((part) => (
                      <button
                        key={part.id}
                        onClick={() => { setSelectedPart(part.id); setPartsOpen(false) }}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-surface-3 transition-colors',
                          selectedPart === part.id ? 'text-text-primary font-medium' : 'text-text-secondary',
                        )}
                      >
                        {selectedPart === part.id && <Check size={11} />}
                        <span className={selectedPart !== part.id ? 'ml-[19px]' : ''}>{part.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Score PDF */}
            <div className="h-[480px] overflow-y-auto">
              <object
                data={`${MOCK_SCORE.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                type="application/pdf"
                className="w-full h-[1400px]"
              >
                <iframe
                  src={`${MOCK_SCORE.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                  className="w-full h-[1400px] border-0"
                  title="Score"
                />
              </object>
            </div>
          </div>
        </div>

        {/* ── Practice progress ────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Practice Progress</h2>
            <span className="text-2xs text-text-muted font-mono">
              {PROGRESS_SECTIONS.filter((s) => s.status === 'done').length}/{PROGRESS_SECTIONS.length} sections
            </span>
          </div>

          {/* Overall bar */}
          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-text-primary rounded-full transition-all"
              style={{ width: `${(PROGRESS_SECTIONS.filter((s) => s.status === 'done').length / PROGRESS_SECTIONS.length) * 100}%` }}
            />
          </div>

          {/* Section grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PROGRESS_SECTIONS.map((section) => (
              <div
                key={section.id}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors',
                  section.status === 'done' && 'bg-surface-0 border-border',
                  section.status === 'current' && 'bg-surface-0 border-text-primary',
                  section.status === 'locked' && 'bg-surface-1 border-border opacity-50',
                )}
              >
                <div className="flex items-center gap-2">
                  {section.status === 'done' && <Check size={12} className="text-success" />}
                  {section.status === 'current' && <Play size={12} className="text-text-primary" />}
                  {section.status === 'locked' && <span className="w-3 h-3" />}
                  <span className={cn(
                    'text-xs font-medium',
                    section.status === 'locked' ? 'text-text-muted' : 'text-text-primary',
                  )}>
                    {section.label}
                  </span>
                </div>
                {section.status !== 'locked' && (
                  <span className={cn(
                    'text-2xs font-mono',
                    section.accuracy >= 90 ? 'text-success' : section.accuracy >= 80 ? 'text-warning' : 'text-text-muted',
                  )}>
                    {section.accuracy}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
