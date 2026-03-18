import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Music,
  Layers,
  Wrench,
  FolderOpen,
  TrendingUp,
  Guitar,
  Radio,
  Zap,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { ChatMessage } from '@/components/agent/ChatMessage'
import { ChatInput } from '@/components/agent/ChatInput'
import { useAgentStore } from '@/stores/agentStore'
import { useAgent } from '@/hooks/useAgent'

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECOMMENDATIONS = [
  { icon: BookOpen, label: 'Learn Autumn Leaves', sub: 'Jazz standard — All levels', to: '/learn' },
  { icon: Guitar, label: 'Practice Hotel California', sub: 'Classic rock guitar', to: '/learn' },
  { icon: Layers, label: 'Write a lo-fi beat', sub: 'Chilled production', to: '/create' },
  { icon: Music, label: 'Jam in D minor', sub: 'Free-form session', to: '/jam' },
  { icon: Wrench, label: 'Tune my guitar', sub: 'Chromatic tuner', to: '/tools' },
  { icon: FolderOpen, label: 'Open last session', sub: 'Resume where you left off', to: '/projects' },
]

const SCORE_CHART = [
  { rank: 1, title: 'Clair de Lune', composer: 'Debussy', instrument: 'Piano', difficulty: 'Advanced', plays: 98 },
  { rank: 2, title: 'Bohemian Rhapsody', composer: 'Queen', instrument: 'Piano', difficulty: 'Intermediate', plays: 91 },
  { rank: 3, title: 'Fly Me to the Moon', composer: 'Sinatra', instrument: 'Any', difficulty: 'Beginner', plays: 87 },
  { rank: 4, title: 'River Flows in You', composer: 'Yiruma', instrument: 'Piano', difficulty: 'Beginner', plays: 83 },
  { rank: 5, title: 'Hotel California', composer: 'Eagles', instrument: 'Guitar', difficulty: 'Intermediate', plays: 79 },
  { rank: 6, title: 'Für Elise', composer: 'Beethoven', instrument: 'Piano', difficulty: 'Beginner', plays: 74 },
]

const SONG_CHART = [
  { rank: 1, title: 'Blinding Lights', artist: 'The Weeknd', bpm: 171, key: 'F min', change: 'up' },
  { rank: 2, title: 'As It Was', artist: 'Harry Styles', bpm: 174, key: 'G maj', change: 'same' },
  { rank: 3, title: 'Anti-Hero', artist: 'Taylor Swift', bpm: 96, key: 'C maj', change: 'up' },
  { rank: 4, title: 'Levitating', artist: 'Dua Lipa', bpm: 103, key: 'B min', change: 'down' },
  { rank: 5, title: 'Shape of You', artist: 'Ed Sheeran', bpm: 96, key: 'C# min', change: 'same' },
  { rank: 6, title: 'Stay', artist: 'The Kid LAROI', bpm: 170, key: 'D maj', change: 'up' },
]

const PEDALS = [
  { name: 'Tube Screamer', type: 'Overdrive', brand: 'Ibanez', color: '#22c55e', popularity: 95, genre: 'Blues · Rock' },
  { name: 'Big Muff', type: 'Fuzz', brand: 'Electro-Harmonix', color: '#ef4444', popularity: 88, genre: 'Rock · Grunge' },
  { name: 'Holy Grail', type: 'Reverb', brand: 'Electro-Harmonix', color: '#3b82f6', popularity: 84, genre: 'Ambient · Shoegaze' },
  { name: 'DD-8', type: 'Delay', brand: 'Boss', color: '#f59e0b', popularity: 80, genre: 'All styles' },
  { name: 'CE-2W', type: 'Chorus', brand: 'Boss', color: '#8b5cf6', popularity: 76, genre: 'Funk · Jazz' },
  { name: 'Crybaby', type: 'Wah', brand: 'Dunlop', color: '#ec4899', popularity: 72, genre: 'Funk · Rock' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const { sendMessage } = useAgent()
  const bottomRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-8 pb-12">

        {/* ── AI Chat ─────────────────────────────────────────── */}
        <section>
          <h1 className="text-xl font-semibold text-text-primary mb-4">LAVA AI</h1>
          <div className="flex flex-col bg-surface-0 border border-border rounded-xl overflow-hidden"
               style={{ height: 'clamp(300px, 48vh, 520px)' }}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <Radio size={28} className="text-text-muted" />
                  <p className="text-sm text-text-secondary font-medium">What do you want to make?</p>
                  <p className="text-xs text-text-muted max-w-sm">
                    Ask me to help you learn a song, start a jam, compose ideas, or find the right
                    tools — I'll navigate you there.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {isStreaming && streamingContent && (
                    <ChatMessage
                      message={{ id: 'streaming', role: 'assistant', content: streamingContent, createdAt: Date.now() }}
                      isStreaming
                    />
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>
            {/* Input */}
            <div className="border-t border-border p-3 shrink-0">
              <ChatInput onSend={sendMessage} disabled={isStreaming} />
            </div>
          </div>
        </section>

        {/* ── Recommendations ─────────────────────────────────── */}
        <section>
          <SectionHeader icon={<Zap size={15} />} title="Recommended for you" />
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {RECOMMENDATIONS.map(({ icon: Icon, label, sub, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="flex flex-col gap-2 p-4 bg-surface-0 border border-border hover:border-border-hover hover:bg-surface-2 rounded-xl text-left shrink-0 w-44 transition-colors group"
              >
                <Icon size={17} className="text-text-muted group-hover:text-text-secondary" />
                <div>
                  <p className="text-xs font-medium text-text-primary leading-snug">{label}</p>
                  <p className="text-2xs text-text-muted mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Three Charts Side by Side ────────────────────────── */}
        <div className="grid grid-cols-3 gap-4" style={{ height: '360px' }}>

          {/* Music Score Chart */}
          <ChartCard icon={<TrendingUp size={14} />} title="Sheet Music Chart">
            {SCORE_CHART.map((item) => (
              <div
                key={item.rank}
                className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 transition-colors cursor-pointer rounded-lg group"
              >
                <span className={cn(
                  'text-xs font-mono w-4 shrink-0 text-right',
                  item.rank <= 3 ? 'text-text-primary font-semibold' : 'text-text-muted',
                )}>
                  {item.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{item.title}</p>
                  <p className="text-2xs text-text-muted truncate">{item.composer} · {item.instrument}</p>
                </div>
                <span className={cn(
                  'text-2xs px-1.5 py-0.5 rounded-full border shrink-0',
                  item.difficulty === 'Beginner' && 'border-success text-success',
                  item.difficulty === 'Intermediate' && 'border-warning text-warning',
                  item.difficulty === 'Advanced' && 'border-error text-error',
                )}>
                  {item.difficulty[0]}
                </span>
              </div>
            ))}
          </ChartCard>

          {/* Song Chart */}
          <ChartCard icon={<Radio size={14} />} title="Song Chart">
            {SONG_CHART.map((item) => (
              <div
                key={item.rank}
                className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 transition-colors cursor-pointer rounded-lg"
              >
                <span className={cn(
                  'text-xs font-mono w-4 shrink-0 text-right',
                  item.rank <= 3 ? 'text-text-primary font-semibold' : 'text-text-muted',
                )}>
                  {item.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{item.title}</p>
                  <p className="text-2xs text-text-muted truncate">{item.artist}</p>
                </div>
                <div className="text-2xs font-mono text-text-muted shrink-0 text-right">
                  <p>{item.bpm} BPM</p>
                  <p>{item.key}</p>
                </div>
                <ChangeIndicator change={item.change} />
              </div>
            ))}
          </ChartCard>

          {/* Guitar Pedal Effects */}
          <ChartCard icon={<Guitar size={14} />} title="Pedal Effects">
            {PEDALS.map((pedal, i) => (
              <div
                key={pedal.name}
                className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 transition-colors cursor-pointer rounded-lg group"
              >
                <span className="text-xs font-mono w-4 shrink-0 text-right text-text-muted">
                  {i + 1}
                </span>
                <div
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: pedal.color + '22' }}
                >
                  <Guitar size={12} style={{ color: pedal.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{pedal.name}</p>
                  <p className="text-2xs text-text-muted truncate">{pedal.type} · {pedal.brand}</p>
                </div>
                <div className="w-12 shrink-0">
                  <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pedal.popularity}%`, backgroundColor: pedal.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </ChartCard>

        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-text-muted">{icon}</span>
      <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>
    </div>
  )
}

function ChangeIndicator({ change }: { change: string }) {
  if (change === 'up') return <span className="text-success text-xs">▲</span>
  if (change === 'down') return <span className="text-error text-xs">▼</span>
  return <span className="text-text-muted text-xs">—</span>
}

function ChartCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col bg-surface-0 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <span className="text-text-muted">{icon}</span>
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {children}
      </div>
    </div>
  )
}
