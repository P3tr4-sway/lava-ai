import { X, Volume2 } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/components/ui/utils'

export interface PlaybackStyleOption {
  id: string
  label: string
  subtitle: string
  description: string
  category: 'acoustic' | 'keys' | 'ensemble' | 'practice'
}

interface PlaybackStylePickerDrawerProps {
  open: boolean
  onClose: () => void
  options: PlaybackStyleOption[]
  selectedPlaybackStyleId: string
  onSelectPlaybackStyle: (id: string) => void
}

const CATEGORY_LABELS: Record<PlaybackStyleOption['category'], string> = {
  acoustic: 'Acoustic',
  keys: 'Keys',
  ensemble: 'Ensemble',
  practice: 'Practice',
}

export function PlaybackStylePickerDrawer({
  open,
  onClose,
  options,
  selectedPlaybackStyleId,
  onSelectPlaybackStyle,
}: PlaybackStylePickerDrawerProps) {
  const isMobile = useIsMobile()

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'w-full rounded-[28px] border border-border bg-surface-0 shadow-2xl',
            isMobile ? 'max-w-[min(100vw-24px,560px)] px-4 py-4' : 'max-w-[520px] px-5 py-5',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Playback Styles</p>
              <p className="mt-1 text-xs text-text-muted">Playback sound.</p>
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
            {(['acoustic', 'keys', 'ensemble', 'practice'] as const).map((category) => {
              const categoryOptions = options.filter((option) => option.category === category)
              if (categoryOptions.length === 0) return null

              return (
                <section key={category}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <div className="flex flex-col gap-2">
                    {categoryOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          onSelectPlaybackStyle(option.id)
                          onClose()
                        }}
                        className={cn(
                          'rounded-2xl border px-3.5 py-3 text-left transition-colors',
                          selectedPlaybackStyleId === option.id
                            ? 'border-text-primary/25 bg-surface-1'
                            : 'border-border bg-surface-0 hover:border-border-hover hover:bg-surface-1',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                              selectedPlaybackStyleId === option.id
                                ? 'bg-text-primary text-surface-0'
                                : 'bg-surface-2 text-text-secondary',
                            )}
                          >
                            <Volume2 size={15} />
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-text-primary">{option.label}</p>
                              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
                                {option.subtitle}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-text-muted">{option.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
