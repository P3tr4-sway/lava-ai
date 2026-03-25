# HomePage Picked-For-You Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Quick Start section from HomePage and replace the static "Picked for you" chord chart cards with live YouTube results that open the same SongActionModal used in the search results page.

**Architecture:** Extract `SongActionModal` and its helpers from `SearchResultsPage.tsx` into a shared `SongActionModal.tsx` file, update `SearchResultsPage.tsx` to re-import from there, then rewrite the `HomePage` Picked-For-You section to fetch YouTube results on mount and open the modal on card click.

**Tech Stack:** React 18, TypeScript 5 (strict), Vite, `youtubeService` (existing), Zustand `taskStore` (existing), React Router v6.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `client/src/components/ui/SongActionModal.tsx` | **Create** | Shared modal + Thumbnail/YtIcon/YtBadge/YtButton helpers + GRADIENTS + toYoutubeResult |
| `client/src/components/ui/index.ts` | **Modify** | Add SongActionModal export |
| `client/src/spaces/search/SearchResultsPage.tsx` | **Modify** | Remove local declarations, import from SongActionModal |
| `client/src/spaces/home/HomePage.tsx` | **Modify** | Remove Quick Start, add YouTube fetch + PickedCard + SongActionModal |

---

## Task 1: Create shared SongActionModal component

**Files:**
- Create: `client/src/components/ui/SongActionModal.tsx`
- Modify: `client/src/components/ui/index.ts`

- [ ] **Step 1: Create the shared file**

Create `client/src/components/ui/SongActionModal.tsx` with all the code moved verbatim from `SearchResultsPage.tsx`. The only things moving out of that file are: `GRADIENTS`, `toYoutubeResult`, `Thumbnail`, `YtIcon`, `YtBadge`, `YtButton`, and `SongActionModal`.

```tsx
import { useEffect, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, Music2, Sparkles, Headphones } from 'lucide-react'
import { cn } from './utils'
import { youtubeService } from '@/services/youtubeService'
import type { YoutubeSearchResult } from '@/services/youtubeService'
import type { YoutubeResult } from '@/data/mockSearchResults'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useTaskStore } from '@/stores/taskStore'

// Gradient palette for results without thumbnails
export const GRADIENTS = [
  'from-amber-800 to-stone-900',
  'from-blue-800 to-slate-900',
  'from-emerald-800 to-slate-900',
  'from-rose-800 to-slate-900',
  'from-cyan-800 to-slate-900',
  'from-violet-800 to-slate-900',
  'from-orange-800 to-stone-900',
  'from-teal-800 to-slate-900',
  'from-lime-800 to-slate-900',
  'from-red-800 to-slate-900',
]

/** Map API result to the UI-facing YoutubeResult */
export function toYoutubeResult(r: YoutubeSearchResult, idx: number): YoutubeResult {
  return {
    id: r.id,
    title: r.title,
    artist: r.channel,
    channel: r.channel,
    duration: r.duration,
    views: r.views,
    uploadedAt: r.uploadedAt,
    gradient: GRADIENTS[idx % GRADIENTS.length],
    thumbnail: r.thumbnail,
  }
}

// ─── Thumbnail helper ────────────────────────────────────────────────────────

export function Thumbnail({
  result,
  className,
  children,
}: {
  result: YoutubeResult
  className?: string
  children?: React.ReactNode
}) {
  const [imgError, setImgError] = useState(false)

  if (result.thumbnail && !imgError) {
    return (
      <div className={cn('relative bg-surface-3', className)}>
        <img
          src={result.thumbnail}
          alt={result.title}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
        {children}
      </div>
    )
  }

  return (
    <div className={cn('relative bg-gradient-to-br', result.gradient, className)}>
      {children}
    </div>
  )
}

// ─── YouTube UI elements ─────────────────────────────────────────────────────

export function YtIcon() {
  return (
    <svg width="13" height="9" viewBox="0 0 13 9" fill="none" aria-hidden="true">
      <rect width="13" height="9" rx="2" fill="#ff0000" />
      <path d="M5.2 6.3V2.7L8.8 4.5L5.2 6.3Z" fill="white" />
    </svg>
  )
}

export function YtBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-[#ff0000] bg-[#ff0000]/10 border border-[#ff0000]/20 shrink-0">
      <YtIcon />
      YouTube
    </span>
  )
}

export function YtButton({ videoId }: { videoId: string }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-full hover:border-border-hover hover:text-text-primary transition-colors"
    >
      <YtIcon />
      YouTube
    </a>
  )
}

// ─── Song Action Modal ────────────────────────────────────────────────────────

interface SongActionModalProps {
  result: YoutubeResult
  onClose: () => void
}

export function SongActionModal({ result, onClose }: SongActionModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { requireAuth } = useRequireAuth()
  const addTask = useTaskStore((s) => s.addTask)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleGenerate = useCallback(async () => {
    if (!requireAuth('AI Score Generation')) return
    try {
      const transcriptionId = await youtubeService.startAnalysis(result.id, result.title)
      addTask(transcriptionId, result.id, result.title)
      navigate(`/play/${transcriptionId}?generate=1`)
      onClose()
    } catch (err) {
      console.error('Failed to start analysis:', err)
    }
  }, [result.id, result.title, navigate, requireAuth, addTask, onClose])

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
            {result.thumbnail ? (
              <img
                src={result.thumbnail}
                alt=""
                className="w-14 h-14 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className={cn('w-14 h-14 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center', result.gradient)}>
                <Music2 size={22} className="text-surface-0/80" />
              </div>
            )}
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-base font-semibold text-text-primary leading-snug line-clamp-2">{result.title}</p>
              <p className="text-sm text-text-muted mt-0.5">{result.channel}</p>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-border" />

        {/* Action buttons */}
        <div className="px-5 py-4 flex flex-col gap-3">

          {/* Option A: AI Score + Backing Track */}
          <button
            onClick={handleGenerate}
            className="w-full flex items-start gap-4 p-4 bg-text-primary rounded-xl transition-opacity text-left hover:opacity-90"
          >
            <div className="w-10 h-10 rounded-full bg-surface-0/15 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={18} className="text-surface-0" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-0">AI Score + Backing Track</p>
              <p className="text-xs text-surface-0/60 mt-0.5 leading-relaxed">
                Auto-detect key & tempo · Generate chord chart · Matched backing track
              </p>
            </div>
            <ArrowRight size={16} className="text-surface-0/50 shrink-0 mt-1" />
          </button>

          {/* Option B: Backing track only */}
          <button
            onClick={() => navigate(`/play/${result.id}`)}
            className="w-full flex items-start gap-4 p-4 bg-surface-0 border border-border hover:border-border-hover rounded-xl transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center shrink-0 group-hover:bg-surface-4 transition-colors mt-0.5">
              <Headphones size={18} className="text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">Backing Track Only</p>
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
```

- [ ] **Step 2: Export SongActionModal from the barrel**

In `client/src/components/ui/index.ts`, add one line:

```ts
export { SongActionModal } from './SongActionModal'
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```

Expected: pass (no errors in the new file).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ui/SongActionModal.tsx client/src/components/ui/index.ts
git commit -m "feat: extract SongActionModal to shared ui component"
```

---

## Task 2: Update SearchResultsPage to import from shared location

**Files:**
- Modify: `client/src/spaces/search/SearchResultsPage.tsx`

- [ ] **Step 1: Remove local declarations, add shared imports**

In `SearchResultsPage.tsx`:

**Remove** these local declarations (they now live in `SongActionModal.tsx`):
- `GRADIENTS` constant
- `toYoutubeResult` function
- `Thumbnail` component
- `YtIcon` function
- `YtBadge` function
- `YtButton` function
- `SongActionModal` function

**Replace** the existing import block at the top. The import that previously read:
```ts
import { youtubeService, type YoutubeSearchResult } from '@/services/youtubeService'
```
...can have `YoutubeSearchResult` removed since `toYoutubeResult` no longer lives here. Keep `youtubeService`.

**Add** this import after the existing imports:
```ts
import { SongActionModal, Thumbnail, YtButton, toYoutubeResult } from '@/components/ui/SongActionModal'
```

The file still keeps: `SearchSkeleton`, `TopResultCard`, `SearchResultCard` — these are page-specific and stay local.

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```

Expected: pass. If there are missing import errors, check which identifier is still referenced locally but now needs the shared import.

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/search/SearchResultsPage.tsx
git commit -m "refactor: import SongActionModal and helpers from shared ui"
```

---

## Task 3: Rewrite HomePage — remove Quick Start, add YouTube Picked For You

**Files:**
- Modify: `client/src/spaces/home/HomePage.tsx`

- [ ] **Step 1: Rewrite HomePage.tsx**

Replace the entire file with the following. Key changes vs current:
- `QuickStartCard` component and props — deleted
- Section 2 "Quick start" — deleted
- `RECOMMENDED_CHARTS`, `DIFFICULTY_MAP` constants and `CHORD_CHARTS` import — deleted
- Section 4 "Picked for you" — replaced with YouTube fetch + `PickedCard` + `SongActionModal`
- New imports: `youtubeService`, `toYoutubeResult`, `SongActionModal`, `YoutubeResult`

```tsx
import { useRef, useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Play, X } from 'lucide-react'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { PricingCards } from '@/components/marketing/PricingCards'
import { cn } from '@/components/ui/utils'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { youtubeService } from '@/services/youtubeService'
import { SongActionModal, Thumbnail, toYoutubeResult } from '@/components/ui/SongActionModal'
import type { YoutubeResult } from '@/data/mockSearchResults'

const SUGGESTIONS = [
  'Wonderwall by Oasis',
  'Hotel California',
  'A simple blues in E',
  'Something easy for beginners',
]

// TODO: replace with real auth + activity data
const LAST_PLAYED = {
  id: 'wish-you-were-here',
  title: 'Wish You Were Here',
  artist: 'Pink Floyd',
  progress: 45,
  section: 'Chorus',
}

// ─── PickedCard ───────────────────────────────────────────────────────────────

function PickedCard({ result, onClick }: { result: YoutubeResult; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 group"
    >
      {/* Thumbnail */}
      <Thumbnail result={result} className="aspect-video w-full">
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center size-12 rounded-full bg-black/50 backdrop-blur-sm">
            <Play size={20} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-white text-xs font-medium tabular-nums">
          {result.duration}
        </div>
      </Thumbnail>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-1">
        <p className="text-sm font-medium text-text-primary line-clamp-2 leading-snug">{result.title}</p>
        <p className="text-xs text-text-secondary truncate">{result.channel}</p>
        <p className="text-xs text-text-muted">{result.views} views</p>
      </div>
    </div>
  )
}

// ─── PickedSkeleton ───────────────────────────────────────────────────────────

function PickedSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col bg-surface-0 border border-border rounded-xl overflow-hidden">
          <div className="aspect-video w-full bg-surface-3" />
          <div className="p-3.5 flex flex-col gap-2">
            <div className="h-3.5 w-full bg-surface-3 rounded" />
            <div className="h-3 w-3/4 bg-surface-3 rounded" />
            <div className="h-3 w-1/2 bg-surface-3 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const chatRef = useRef<ChatInputRef>(null)
  const [showBanner, setShowBanner] = useState(true)
  const { isAuthenticated } = useRequireAuth()

  // Picked for you — YouTube fetch
  const [pickedSongs, setPickedSongs] = useState<YoutubeResult[]>([])
  const [pickedLoading, setPickedLoading] = useState(true)
  const [selectedSong, setSelectedSong] = useState<YoutubeResult | null>(null)

  useEffect(() => {
    let cancelled = false
    setPickedLoading(true)

    youtubeService.search('popular guitar songs', 8)
      .then((data) => {
        if (cancelled) return
        setPickedSongs(data.map(toYoutubeResult))
      })
      .catch(() => {
        if (cancelled) return
        setPickedSongs([])
      })
      .finally(() => {
        if (!cancelled) setPickedLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const handleSend = (message: string) => {
    navigate(`/search?q=${encodeURIComponent(message)}`)
  }

  return (
    <div className="h-full overflow-y-auto">

      {/* Guests: sign-up CTA banner */}
      {!isAuthenticated && (
        <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Create a free account to save your progress and unlock AI features
          </p>
          <Link to="/signup" className="text-sm font-medium text-accent hover:underline shrink-0 ml-4">
            Sign Up Free
          </Link>
        </div>
      )}

      {/* Logged-in: upgrade banner */}
      {isAuthenticated && showBanner && (
        <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">Free Plan</span> — 3 AI transcriptions per month
          </p>
          <div className="flex items-center gap-3">
            <Link to="/pricing" className="text-sm font-medium text-accent hover:underline">
              Upgrade
            </Link>
            <button
              onClick={() => setShowBanner(false)}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 pt-[22vh] flex flex-col gap-10 pb-12">

        {/* ── 1. Hero — search-first ────────────────────────────── */}
        <section>
          <h1 className="text-3xl font-bold text-text-primary mb-2 text-center">What do you want to play?</h1>
          <p className="text-sm text-text-secondary text-center mb-6">Search for any song — AI generates the score and backing track for you</p>
          <ChatInput ref={chatRef} onSend={handleSend} placeholder="Song name, artist, or paste a link..." />

          {/* Suggestion tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => chatRef.current?.setValue(s)}
                className="px-3 py-1.5 text-xs text-text-secondary bg-surface-1 border border-border rounded-full hover:border-border-hover hover:text-text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* ── 2. Continue where you left off (logged-in only) ───── */}
        {isAuthenticated && (
          <section>
            <button
              onClick={() => navigate(`/learn/songs/${LAST_PLAYED.id}`)}
              className="w-full bg-surface-1 border border-border hover:border-border-hover rounded-2xl p-6 cursor-pointer transition-all group text-left"
            >
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-2">Continue playing</p>
                  <p className="text-2xl font-bold text-text-primary leading-tight truncate">{LAST_PLAYED.title}</p>
                  <p className="text-sm text-text-secondary mt-1">{LAST_PLAYED.artist} · {LAST_PLAYED.section}</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Play size={22} className="text-surface-0 ml-1" fill="currentColor" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-text-primary rounded-full" style={{ width: `${LAST_PLAYED.progress}%` }} />
                </div>
                <span className="text-xs font-medium text-text-secondary shrink-0">{LAST_PLAYED.progress}%</span>
              </div>
            </button>
          </section>
        )}

        {/* ── 3. Picked for you ─────────────────────────────────── */}
        {(pickedLoading || pickedSongs.length > 0) && (
          <section>
            <p className="text-sm text-text-muted mb-4">Picked for you</p>
            {pickedLoading ? (
              <PickedSkeleton />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {pickedSongs.map((song) => (
                  <PickedCard
                    key={song.id}
                    result={song}
                    onClick={() => setSelectedSong(song)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 4. Pricing (guests only) ─────────────────────────── */}
        {!isAuthenticated && (
          <section>
            <p className="text-sm text-text-muted mb-4">Plans & Pricing</p>
            <PricingCards />
          </section>
        )}

        {/* ── 5. Free tier note ─────────────────────────────────── */}
        <p className="text-xs text-text-muted text-center">
          3 free AI transcriptions every month · No credit card required
        </p>

      </div>

      {/* Song action modal */}
      {selectedSong && (
        <SongActionModal
          result={selectedSong}
          onClose={() => setSelectedSong(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```

Expected: pass with no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/home/HomePage.tsx
git commit -m "feat: replace quick-start and picked-for-you with live YouTube cards"
```

---

## Done

After Task 3 the feature is complete. Verify visually:
1. `pnpm dev` → open `http://localhost:5173`
2. Homepage should show: hero search → (logged-in: continue playing) → "Picked for you" skeleton → 8 YouTube cards
3. Click any card → SongActionModal opens with AI Score + Backing Track and Backing Track Only options
4. Confirm Quick Start (Learn a Song / Jam Session / Create Lead Sheet) is gone
5. Search page still works — click a result → same modal opens
