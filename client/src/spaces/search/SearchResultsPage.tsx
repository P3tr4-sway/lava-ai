import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Pause, Search, Music2, Sparkles, X, ArrowRight, Loader2, Headphones } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { MOCK_SEARCH_RESULTS, type YoutubeResult } from '@/data/mockSearchResults'

// ─── Page ──────────────────────────────────────────────────────────────────

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(query)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedResult, setSelectedResult] = useState<YoutubeResult | null>(null)

  useEffect(() => {
    setInputValue(query)
    setIsLoading(true)
    const t = setTimeout(() => setIsLoading(false), 1200)
    return () => clearTimeout(t)
  }, [query])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || trimmed === query) return
    setSearchParams({ q: trimmed })
  }

  const handleResultClick = (result: YoutubeResult) => {
    setSelectedResult(result)
  }

  const topResult = MOCK_SEARCH_RESULTS[0]
  const otherResults = MOCK_SEARCH_RESULTS.slice(1)

  return (
    <div className="h-full overflow-y-auto">

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-surface-0/90 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </button>

        <form onSubmit={handleSearch} className="flex-1 relative max-w-xl">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-full pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-hover transition-colors"
            placeholder="Search for a song..."
          />
        </form>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <SearchSkeleton />
        ) : (
          <div className="flex flex-col gap-10">

            {/* Top Result */}
            <section>
              <p className="text-sm text-text-muted mb-4">Top result</p>
              <TopResultCard
                result={topResult}
                onViewSheet={() => handleResultClick(topResult)}
              />
            </section>

            {/* All Results */}
            <section>
              <p className="text-sm text-text-muted mb-4">
                All results{' '}
                <span className="text-text-muted/60">({MOCK_SEARCH_RESULTS.length})</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {otherResults.map((result) => (
                  <SearchResultCard
                    key={result.id}
                    result={result}
                    onClick={() => handleResultClick(result)}
                  />
                ))}
              </div>
            </section>

          </div>
        )}
      </div>

      {/* ── Song Action Modal ─────────────────────────────────────── */}
      {selectedResult && (
        <SongActionModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          onGenerate={(songId) => navigate(`/learn/songs/${songId}?generate=1`)}
          onViewScore={(songId) => navigate(`/learn/songs/${songId}`)}
        />
      )}
    </div>
  )
}

// ─── Top Result Card ───────────────────────────────────────────────────────

function TopResultCard({
  result,
  onViewSheet,
}: {
  result: YoutubeResult
  onViewSheet: () => void
}) {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="border border-border hover:border-border-hover rounded-lg overflow-hidden bg-surface-0 transition-colors">

      {/* Thumbnail */}
      <div className={cn('relative aspect-video w-full bg-gradient-to-br', result.gradient)}>

        {/* Play / Pause — always visible */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center justify-center size-16 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            {isPlaying
              ? <Pause size={28} className="text-white" fill="white" />
              : <Play size={28} className="text-white ml-1" fill="white" />
            }
          </button>
          <span className="text-white/60 text-xs font-medium tracking-wide">Preview</span>
        </div>

        {/* Waveform — visible when playing */}
        {isPlaying && (
          <>
            <style>{`
              @keyframes waveBar {
                0%, 100% { transform: scaleY(0.3); }
                50% { transform: scaleY(1); }
              }
            `}</style>
            <div className="absolute bottom-4 left-5 flex items-end gap-[3px] h-5">
              {[100, 55, 80, 40, 90, 60, 75].map((pct, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-white/70 rounded-full origin-bottom"
                  style={{
                    height: `${pct}%`,
                    animation: 'waveBar 0.65s ease-in-out infinite',
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-black/70 rounded text-white text-xs font-medium tabular-nums">
          {result.duration}
        </div>
      </div>

      {/* Info */}
      <div className="p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary leading-snug mb-1.5">
            {result.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-text-secondary">
            <span>{result.channel}</span>
            <span className="text-text-muted">·</span>
            <span>{result.views} views</span>
            <span className="text-text-muted">·</span>
            <span>{result.uploadedAt}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onViewSheet}
            className="flex items-center gap-2 px-5 py-2.5 bg-text-primary text-surface-0 text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
          >
            <Music2 size={15} />
            View Sheet Music
          </button>
          <YtButton />
        </div>
      </div>
    </div>
  )
}

// ─── Search Result Card (grid) ─────────────────────────────────────────────

function SearchResultCard({
  result,
  onClick,
}: {
  result: YoutubeResult
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 group"
    >
      {/* Thumbnail */}
      <div className={cn('relative aspect-video w-full bg-gradient-to-br', result.gradient)}>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center size-12 rounded-full bg-black/50 backdrop-blur-sm">
            <Play size={20} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-white text-xs font-medium tabular-nums">
          {result.duration}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1.5">
        <p className="text-sm font-medium text-text-primary line-clamp-2 leading-snug">
          {result.title}
        </p>
        <div className="flex items-center gap-2">
          <YtBadge />
          <span className="text-xs text-text-secondary truncate">{result.channel}</span>
        </div>
        <p className="text-xs text-text-muted">{result.views} views · {result.uploadedAt}</p>
      </div>
    </div>
  )
}

// ─── YouTube UI elements ───────────────────────────────────────────────────

function YtIcon() {
  return (
    <svg width="13" height="9" viewBox="0 0 13 9" fill="none" aria-hidden="true">
      <rect width="13" height="9" rx="2" fill="#ff0000" />
      <path d="M5.2 6.3V2.7L8.8 4.5L5.2 6.3Z" fill="white" />
    </svg>
  )
}

function YtBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-[#ff0000] bg-[#ff0000]/10 border border-[#ff0000]/20 shrink-0">
      <YtIcon />
      YouTube
    </span>
  )
}

function YtButton() {
  return (
    <button
      disabled
      title="Open on YouTube (coming soon)"
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-full opacity-50 cursor-not-allowed"
    >
      <YtIcon />
      YouTube
    </button>
  )
}

// ─── Song Action Modal ────────────────────────────────────────────────────

function SongActionModal({
  result,
  onClose,
  onGenerate,
  onViewScore,
}: {
  result: YoutubeResult
  onClose: () => void
  onGenerate: (songId: string) => void
  onViewScore: (songId: string) => void
}) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const songId = result.songId ?? 'wonderwall'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleGenerate = () => {
    setGenerating(true)
    // Simulate AI processing then navigate
    setTimeout(() => onGenerate(songId), 1800)
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-md bg-surface-1 border border-border rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-200">

        {/* Header — song info */}
        <div className="relative px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-4">
            <div className={cn('w-14 h-14 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center', result.gradient)}>
              <Music2 size={22} className="text-surface-0/80" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-base font-semibold text-text-primary leading-snug line-clamp-2">{result.title}</p>
              <p className="text-sm text-text-muted mt-0.5">{result.artist}</p>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-border" />

        {/* Options */}
        <div className="px-5 py-4 flex flex-col gap-3">

          {/* Option A: AI Score + Backing Track — primary */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-start gap-4 p-4 bg-text-primary rounded-xl transition-opacity text-left disabled:opacity-60 hover:opacity-90"
          >
            <div className="w-10 h-10 rounded-full bg-surface-0/15 flex items-center justify-center shrink-0 mt-0.5">
              {generating
                ? <Loader2 size={18} className="text-surface-0 animate-spin" />
                : <Sparkles size={18} className="text-surface-0" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-0">
                {generating ? 'Generating...' : 'AI 生成乐谱 + 伴奏'}
              </p>
              <p className="text-xs text-surface-0/60 mt-0.5 leading-relaxed">
                {generating
                  ? 'Analyzing audio, extracting chords and melody...'
                  : 'Auto-detect key & tempo · Generate guitar tabs · Matched backing track'
                }
              </p>
            </div>
            {!generating && <ArrowRight size={16} className="text-surface-0/50 shrink-0 mt-1" />}
          </button>

          {/* Option B: Backing track only */}
          <button
            onClick={() => onViewScore(songId)}
            className="w-full flex items-start gap-4 p-4 bg-surface-0 border border-border hover:border-border-hover rounded-xl transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center shrink-0 group-hover:bg-surface-4 transition-colors mt-0.5">
              <Headphones size={18} className="text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">只要伴奏</p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">Generate a backing track only · Read your own score while playing along</p>
            </div>
            <ArrowRight size={16} className="text-text-muted shrink-0 mt-1" />
          </button>

        </div>

        {/* Footer hint */}
        <div className="px-5 pb-5 pt-0">
          <p className="text-2xs text-text-muted text-center">
            3 free AI generations per month · No credit card required
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function SearchSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-10">
      <div>
        <div className="h-4 w-20 bg-surface-3 rounded mb-4" />
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="aspect-video w-full bg-surface-3" />
          <div className="p-6 flex flex-col gap-3">
            <div className="h-5 w-3/4 bg-surface-3 rounded" />
            <div className="h-4 w-1/2 bg-surface-3 rounded" />
            <div className="flex gap-3 mt-1">
              <div className="h-10 w-40 bg-surface-3 rounded-full" />
              <div className="h-10 w-28 bg-surface-3 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="h-4 w-28 bg-surface-3 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <div className="aspect-video w-full bg-surface-3" />
              <div className="p-4 flex flex-col gap-2">
                <div className="h-4 w-full bg-surface-3 rounded" />
                <div className="h-4 w-4/5 bg-surface-3 rounded" />
                <div className="h-3 w-1/2 bg-surface-3 rounded mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
