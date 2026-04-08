import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Share2,
  Heart,
  Download,
  Lock,
  Music,
  ArrowRight,
  Eye,
  Pencil,
  MessageSquare,
  X,
  ChevronLeft,
  Badge as BadgeIcon,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui'
import { Badge } from '@/components/ui'
import { ShareBottomBar } from './ShareBottomBar'
import { ShareAiPanel } from './ShareAiPanel'

// ─── Demo data ──────────────────────────────────────────────────────────────
const DEMO_SCORE = {
  title: 'A Warning',
  artist: 'Lamb of God',
  creator: { name: 'GuitarPro User' },
  instrument: 'Electric Guitar',
  difficulty: 'Advanced',
  key: 'D Minor',
  tempo: 184,
  duration: 245,
  views: 1_342,
  likes: 89,
  svgUrl: '/demo-score.svg',
}

/** Percentage of score height visible to unauthenticated users */
const VISIBLE_PERCENT = 32

// ─── Auth simulation (use ?auth=true&edit=true in URL to demo states) ──────
type AuthState = 'guest' | 'viewer' | 'editor'

function useShareAuth(): AuthState {
  const [params] = useSearchParams()
  if (params.get('auth') === 'true') {
    return params.get('edit') === 'true' ? 'editor' : 'viewer'
  }
  return 'guest'
}

// ─── Component ───────────────────────────────────────────────────────────────
export function SharePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const authState = useShareAuth()

  const [liked, setLiked] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(authState !== 'guest')
  const score = DEMO_SCORE

  const isGuest = authState === 'guest'
  const canEdit = authState === 'editor'

  const handleGatedAction = () => {
    if (isGuest) setShowAuthModal(true)
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-0 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-border bg-surface-1 shrink-0 z-30">
        {/* Left: logo + back */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-text-primary hover:opacity-70 transition-opacity shrink-0"
        >
          <ChevronLeft className="size-4 text-text-muted" />
          <Music className="size-4" />
          <span className="font-semibold text-sm hidden sm:inline">LAVA</span>
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Center: score info */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">{score.title}</span>
          <span className="text-text-muted text-xs hidden sm:inline">—</span>
          <span className="text-xs text-text-secondary truncate hidden sm:inline">{score.artist}</span>
          {!isGuest && (
            <Badge className="ml-1 hidden sm:inline-flex">
              {canEdit ? 'Can edit' : 'View only'}
            </Badge>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <Button
              size="sm"
              onClick={() => navigate(`/pack/${id || 'new'}`)}
              className="hidden sm:flex"
            >
              <Pencil className="size-3.5" />
              Open in Editor
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={isGuest ? handleGatedAction : () => setLiked((l) => !l)}
            className={cn(liked && !isGuest && 'text-error')}
            title="Like"
          >
            <Heart className={cn('size-4', liked && !isGuest && 'fill-current')} />
          </Button>

          <Button variant="ghost" size="icon-sm" title="Share">
            <Share2 className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={isGuest ? handleGatedAction : undefined}
            title="Download"
          >
            <div className="relative">
              <Download className="size-4" />
              {isGuest && <Lock className="size-2.5 absolute -bottom-0.5 -right-0.5 text-warning" />}
            </div>
          </Button>

          {!isGuest && (
            <Button
              variant={aiPanelOpen ? 'outline' : 'ghost'}
              size="icon-sm"
              onClick={() => setAiPanelOpen((o) => !o)}
              title="AI Tutor"
            >
              <MessageSquare className="size-4" />
            </Button>
          )}

          {isGuest && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Log in
              </Button>
              <Button size="sm" onClick={() => navigate('/signup')}>
                Sign up
                <ArrowRight className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ── Main content (score + AI panel) ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Score area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24 relative">
          {/* Score meta strip (below topbar, above score) */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-surface-1/60">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge>{score.instrument}</Badge>
              <Badge>{score.difficulty}</Badge>
              <Badge>{score.key}</Badge>
              <span className="text-xs text-text-muted">♩ = {score.tempo}</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" />
                {score.views.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="size-3.5" />
                {score.likes}
              </span>
            </div>
          </div>

          {/* Score render */}
          <div className="relative mx-auto max-w-4xl px-4 pt-4">
            <div className="relative rounded-lg border border-border overflow-hidden bg-white shadow-sm">
              <img
                src={score.svgUrl}
                alt={`${score.title} — ${score.artist}`}
                className="w-full h-auto"
              />

              {/* Guest blur gate ─────────────────────────── */}
              {isGuest && (
                <>
                  {/* Gradient fade */}
                  <div
                    className="absolute left-0 right-0 h-20 pointer-events-none"
                    style={{
                      top: `calc(${VISIBLE_PERCENT}% - 40px)`,
                      background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.85))',
                    }}
                  />
                  {/* Blur overlay */}
                  <div
                    className="absolute left-0 right-0 bottom-0"
                    style={{ top: `${VISIBLE_PERCENT}%` }}
                  >
                    <div className="w-full h-full backdrop-blur-[6px] bg-white/50" />
                  </div>
                  {/* CTA card */}
                  <div
                    className="absolute left-0 right-0 flex items-start justify-center z-10 px-4"
                    style={{ top: `${VISIBLE_PERCENT + 6}%` }}
                  >
                    <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-surface-0/95 backdrop-blur-sm border border-border shadow-xl max-w-sm w-full mt-4">
                      <Lock className="size-6 text-text-muted" />
                      <h3 className="text-base font-semibold text-text-primary text-center">
                        Log in to view the full score
                      </h3>
                      <p className="text-sm text-text-secondary text-center">
                        Get full access to this score, practice tools, and AI tutoring.
                      </p>
                      <Button size="lg" className="w-full" onClick={() => navigate('/signup')}>
                        Create free account
                        <ArrowRight className="size-4" />
                      </Button>
                      <button
                        className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                        onClick={() => navigate('/login')}
                      >
                        Already have an account? Log in
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Editor CTA strip (view-only logged-in) */}
            {!isGuest && !canEdit && (
              <div className="mt-4 flex items-center gap-4 p-4 rounded-lg bg-surface-1 border border-border">
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Want to practice with this score?</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Ask the teacher for edit access, or remix it in your own workspace.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/pack/new`)}
                >
                  Remix
                </Button>
              </div>
            )}

            {/* Editor open strip (editor) */}
            {canEdit && (
              <div className="mt-4 flex items-center gap-4 p-4 rounded-lg bg-surface-1 border border-border">
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">You have edit access</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Open in the Lava editor to make changes and save.
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate(`/pack/${id || 'new'}`)}>
                  <Pencil className="size-3.5" />
                  Open in Editor
                </Button>
              </div>
            )}

            {/* Related scores */}
            {!isGuest && (
              <div className="mt-6 mb-6">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  More from {score.artist}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {['Redneck', 'Walk with Me in Hell', 'Laid to Rest'].map((name) => (
                    <button
                      key={name}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 transition-colors text-left"
                    >
                      <div className="size-8 rounded bg-surface-3 flex items-center justify-center shrink-0">
                        <Music className="size-3.5 text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">{name}</p>
                        <p className="text-[11px] text-text-muted">{score.artist}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Panel */}
        {!isGuest && (
          <ShareAiPanel
            isOpen={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            scoreTitle={score.title}
          />
        )}
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <ShareBottomBar
        duration={score.duration}
        previewLimit={isGuest ? 30 : null}
        onUpgradeClick={isGuest ? handleGatedAction : undefined}
      />

      {/* ── Auth modal ───────────────────────────────────────────────────── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="bg-surface-1 border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base font-semibold text-text-primary">
                Unlock everything with Lava
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowAuthModal(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <p className="text-sm text-text-secondary mb-5">
              Full score view, playback controls, metronome, transpose, speed adjustment, AI tutoring, and more.
            </p>
            <div className="flex flex-col gap-2">
              <Button size="lg" className="w-full" onClick={() => navigate('/signup')}>
                Create free account
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/login')}>
                Log in
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
