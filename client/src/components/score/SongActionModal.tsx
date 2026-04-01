import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Headphones, Music2, Sparkles, X } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import type { ArrangementId } from '@lava/shared'

export type SongActionView = 'lead_sheet' | 'staff' | 'tab'

interface SongActionModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  cover?: ReactNode
  defaultView?: SongActionView
  defaultArrangement?: ArrangementId
  generateTitle?: string
  generateSubtitle?: string
  generateButtonLabel?: string
  trackOnlyLabel?: string
  footerHint?: string
  onGenerate: (selection: { view: SongActionView; arrangement: ArrangementId }) => void | Promise<void>
  onTrackOnly: () => void
}

const VIEW_OPTIONS = [
  { id: 'lead_sheet' as const, label: 'Chords' },
  { id: 'staff' as const, label: 'Staff' },
  { id: 'tab' as const, label: 'Tab' },
]

const ARRANGEMENT_OPTIONS = [
  { id: 'original' as const, label: 'Original' },
  { id: 'simplified' as const, label: 'Simplified' },
  { id: 'sing_play' as const, label: 'Sing & Play' },
  { id: 'solo_focus' as const, label: 'Solo Focus' },
  { id: 'low_position' as const, label: 'Low Position' },
  { id: 'capo' as const, label: 'Capo' },
]

function DefaultCover() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-950 text-surface-0">
      <Music2 size={22} />
    </div>
  )
}

export function SongActionModal({
  open,
  onClose,
  title,
  subtitle,
  cover,
  defaultView = 'lead_sheet',
  defaultArrangement = 'simplified',
  generateTitle = 'Generate Score',
  generateSubtitle = 'Pick view and version.',
  generateButtonLabel = 'Generate',
  trackOnlyLabel = 'Track Only',
  footerHint = '3 free AI breakdowns per month · No credit card required',
  onGenerate,
  onTrackOnly,
}: SongActionModalProps) {
  const [selectedView, setSelectedView] = useState<SongActionView>(defaultView)
  const [selectedArrangement, setSelectedArrangement] = useState<ArrangementId>(defaultArrangement)

  useEffect(() => {
    if (!open) return

    setSelectedView(defaultView)
    setSelectedArrangement(defaultArrangement)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [defaultArrangement, defaultView, onClose, open])

  if (!open) return null

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="w-full overflow-hidden rounded-t-2xl border border-border bg-surface-1 shadow-2xl animate-in slide-in-from-bottom duration-200 sm:max-w-md sm:rounded-xl sm:slide-in-from-bottom-4">
        <div className="relative px-5 pb-4 pt-5">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-4">
            {cover ?? <DefaultCover />}
            <div className="min-w-0 flex-1 pr-6">
              <p className="line-clamp-2 text-base font-semibold leading-snug text-text-primary">{title}</p>
              {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="rounded-xl bg-text-primary p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-0/15">
                <Sparkles size={18} className="text-surface-0" />
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-0">{generateTitle}</p>
                {generateSubtitle ? <p className="text-xs text-surface-0/65">{generateSubtitle}</p> : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-0 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">View</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedView(option.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    selectedView === option.id
                      ? 'border-text-primary/25 bg-surface-2 text-text-primary'
                      : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">Style</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ARRANGEMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedArrangement(option.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors',
                    selectedArrangement === option.id
                      ? 'border-text-primary/25 bg-surface-2 text-text-primary'
                      : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void onGenerate({ view: selectedView, arrangement: selectedArrangement })
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-text-primary px-4 py-3 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90"
            >
              {generateButtonLabel}
              <ArrowRight size={15} className="text-surface-0/70" />
            </button>
            <button
              onClick={onTrackOnly}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-0 px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-surface-2"
            >
              <Headphones size={15} />
              {trackOnlyLabel}
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 pt-0">
          <p className="text-center text-2xs text-text-muted">{footerHint}</p>
        </div>
      </div>
    </div>
  )
}
