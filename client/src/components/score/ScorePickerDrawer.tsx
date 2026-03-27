import { X } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/components/ui/utils'
import type { PlayableArrangement } from '@lava/shared'

interface ScorePickerDrawerProps {
  open: boolean
  onClose: () => void
  arrangements: PlayableArrangement[]
  selectedArrangementId: string
  onSelectArrangement: (id: PlayableArrangement['id']) => void
  scoreView: 'lead_sheet' | 'staff' | 'tab'
  onSelectScoreView: (view: 'lead_sheet' | 'staff' | 'tab') => void
}

const VIEW_OPTIONS = [
  { id: 'lead_sheet' as const, label: 'Chords' },
  { id: 'staff' as const, label: 'Staff' },
  { id: 'tab' as const, label: 'Tab' },
]

export function ScorePickerDrawer({
  open,
  onClose,
  arrangements,
  selectedArrangementId,
  onSelectArrangement,
  scoreView,
  onSelectScoreView,
}: ScorePickerDrawerProps) {
  const isMobile = useIsMobile()

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'w-full rounded-[28px] border border-border bg-surface-0 shadow-2xl',
            isMobile ? 'max-w-[min(100vw-24px,560px)] px-4 py-4' : 'max-w-[620px] px-5 py-5',
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Score Styles</p>
            </div>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <X size={15} />
            </button>
          </div>

          <div
            className={cn(
              'mt-5 flex flex-col gap-5 overflow-y-auto pb-1',
              isMobile ? 'max-h-[min(70vh,560px)]' : 'max-h-[70vh]',
            )}
          >
            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">View</p>
              <div className="grid grid-cols-3 gap-2">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onSelectScoreView(option.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                      scoreView === option.id
                        ? 'border-text-primary/25 bg-surface-1 text-text-primary'
                        : 'border-border bg-surface-0 text-text-secondary hover:border-border-hover hover:text-text-primary',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">Style</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {arrangements.map((arrangement) => (
                  <button
                    key={arrangement.id}
                    onClick={() => onSelectArrangement(arrangement.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      selectedArrangementId === arrangement.id
                        ? 'border-text-primary/25 bg-surface-1'
                        : 'border-border bg-surface-0 hover:border-border-hover hover:bg-surface-1',
                    )}
                  >
                    <p className="text-sm font-medium text-text-primary">{arrangement.label}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">{arrangement.subtitle}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
