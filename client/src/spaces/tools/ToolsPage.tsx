import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import {
  FileAudio,
  Music,
  Sliders,
  Mic,
  Gauge,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import './tools-geist.css'

const TOOLS = [
  {
    id: 'transcribe',
    icon: FileAudio,
    title: 'Transcriber',
    description: 'Convert any audio file to sheet music, MIDI, or chord charts automatically.',
    category: 'audio',
    status: 'BETA' as const,
  },
  {
    id: 'chord',
    icon: Music,
    title: 'Chord Analyzer',
    description: 'Detect and label chords from audio or MIDI in real time.',
    category: 'audio',
    status: 'NEW' as const,
  },
  {
    id: 'effects',
    icon: Sliders,
    title: 'Effects Chain',
    description: 'Apply a full rack of studio-grade effects to any audio in your browser.',
    category: 'audio',
    status: null,
  },
  {
    id: 'recorder',
    icon: Mic,
    title: 'Quick Recorder',
    description: 'Record, trim, and export audio snippets with one click.',
    category: 'audio',
    status: null,
  },
  {
    id: 'bpm',
    icon: Gauge,
    title: 'BPM Detector',
    description: 'Analyse tempo from audio, or tap a beat to get an exact BPM.',
    category: 'notation',
    status: 'NEW' as const,
  },
  {
    id: 'generator',
    icon: Sparkles,
    title: 'Tone Generator',
    description: 'Generate reference tones, scales, and chords from any root note.',
    category: 'creation',
    status: null,
  },
] as const

type Category = 'all' | 'audio' | 'notation' | 'creation'
const FILTERS: Category[] = ['all', 'audio', 'notation', 'creation']

export function ToolsPage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const [filter, setFilter] = useState<Category>('all')

  useEffect(() => {
    setSpaceContext({ currentSpace: 'tools', projectId: id })
  }, [id, setSpaceContext])

  const visible = filter === 'all' ? TOOLS : TOOLS.filter((t) => t.category === filter)

  return (
    <div className="ds h-full overflow-y-auto bg-[var(--ds-background-200)] text-[var(--ds-gray-1000)]">
      {/* Header */}
      <div className="px-6 pt-8 pb-5 border-b border-[var(--ds-gray-400)]">
        <div className="flex items-baseline gap-2.5 mb-1.5">
          <h1 className="text-base font-semibold tracking-tight">Play</h1>
          <span className="font-mono text-[10px] leading-none text-[var(--ds-gray-700)] bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] px-1.5 py-0.5 rounded">
            {TOOLS.length}
          </span>
        </div>
        <p className="text-sm text-[var(--ds-gray-700)]">
          Standalone AI music tools — no project needed.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1 px-6 py-2.5 border-b border-[var(--ds-gray-400)]">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest rounded transition-colors',
              filter === f
                ? 'bg-[var(--ds-gray-1000)] text-[var(--ds-background-200)]'
                : 'text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)]',
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-[var(--ds-gray-600)]">
          {visible.length}/{TOOLS.length}
        </span>
      </div>

      {/* Tool grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {visible.map(({ id: toolId, icon: Icon, title, description, status }) => (
          <button
            key={toolId}
            className={cn(
              'group relative flex items-start gap-3.5 p-4 rounded-lg border text-left',
              'bg-[var(--ds-background-100)] border-[var(--ds-gray-400)]',
              'hover:bg-[var(--ds-gray-100)] hover:border-[var(--ds-gray-500)]',
              'transition-all duration-150',
            )}
          >
            {/* Status badge */}
            {status && (
              <span className="absolute top-3 right-3 font-mono text-[9px] tracking-widest px-1.5 py-0.5 rounded border border-[var(--ds-gray-400)] text-[var(--ds-gray-700)]">
                {status}
              </span>
            )}

            {/* Icon box */}
            <div className="w-8 h-8 rounded border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] flex items-center justify-center shrink-0 mt-0.5 group-hover:border-[var(--ds-gray-500)] transition-colors">
              <Icon size={13} className="text-[var(--ds-gray-700)]" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pr-5">
              <p className="text-sm font-medium text-[var(--ds-gray-1000)] mb-1 leading-none">
                {title}
              </p>
              <p className="text-xs text-[var(--ds-gray-700)] leading-relaxed">{description}</p>
            </div>

            {/* Arrow */}
            <ChevronRight
              size={12}
              className="absolute bottom-3.5 right-3 text-[var(--ds-gray-600)] opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-1 flex items-center gap-2">
        <span className="font-mono text-[10px] text-[var(--ds-gray-600)]">
          geist experiment
        </span>
        <span className="w-0.5 h-0.5 rounded-full bg-[var(--ds-gray-500)]" />
        <span className="font-mono text-[10px] text-[var(--ds-gray-600)]">
          vercel.com/geist
        </span>
      </div>
    </div>
  )
}
