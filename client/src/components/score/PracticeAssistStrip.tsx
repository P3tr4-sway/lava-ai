import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'
import type {
  PracticeAssistMode,
  PracticeAssistStatus,
  PracticeAssistSummary,
} from '@/utils/practiceAssist'

interface PracticeAssistStripProps {
  mode: PracticeAssistMode | null
  status: PracticeAssistStatus
  summary: PracticeAssistSummary | null
  onStartReview: () => void
  onRetryPermission: () => void
  onEndReview: () => void
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
      {children}
    </span>
  )
}

export function PracticeAssistStrip({
  mode,
  status,
  summary,
  onStartReview,
  onRetryPermission,
  onEndReview,
}: PracticeAssistStripProps) {
  const isIdle = status === 'idle'
  const isPermission = status === 'permission'
  const isArming = status === 'arming'
  const isReviewLive = mode === 'review' && status === 'listening'
  const isSummary = status === 'summary' && summary

  return (
    <div className="border-b border-border bg-surface-0">
      <div className="px-4 py-3">
        <div className="rounded-2xl border border-border bg-surface-1/80 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              {isIdle && (
                <>
                  <p className="text-sm font-semibold text-text-primary">AI Assisted Practice</p>
                  <p className="text-sm text-text-secondary">Onsite coaching for this song.</p>
                </>
              )}

              {isPermission && (
                <>
                  <StatusPill>Mic access needed</StatusPill>
                  <p className="mt-2 text-sm text-text-secondary">Allow mic to start.</p>
                </>
              )}

              {isArming && (
                <>
                  <StatusPill>Getting ready...</StatusPill>
                  <p className="mt-2 text-sm text-text-secondary">Start playing when ready.</p>
                </>
              )}

              {isReviewLive && (
                <>
                  <StatusPill>Review in progress</StatusPill>
                  <p className="mt-2 text-sm text-text-secondary">Play through once, then end the pass.</p>
                </>
              )}

              {isSummary && (
                <>
                  <StatusPill>Session summary</StatusPill>
                  <p className="mt-2 text-sm text-text-secondary">Quick take. Run it again if needed.</p>
                </>
              )}
            </div>

            <div className={cn('flex flex-wrap gap-2', isIdle && 'md:justify-end')}>
              {isIdle && (
                <Button onClick={onStartReview}>Review My Play</Button>
              )}

              {isPermission && (
                <>
                  <Button onClick={onRetryPermission}>Allow Mic</Button>
                  <Button variant="outline" onClick={onRetryPermission}>Try Again</Button>
                </>
              )}

              {isReviewLive && (
                <Button onClick={onEndReview}>End Review</Button>
              )}

              {isSummary && (
                <Button onClick={onStartReview}>Review My Play</Button>
              )}
            </div>
          </div>

          {isSummary && summary && (
            <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Timing</p>
                <p className="mt-1 text-sm text-text-primary">{summary.timing}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Chords</p>
                <p className="mt-1 text-sm text-text-primary">{summary.chords}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Next</p>
                <p className="mt-1 text-sm text-text-primary">{summary.next}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
