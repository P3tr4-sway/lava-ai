// client/src/components/calendar/PracticePlanDialog.tsx
import { Music, X } from 'lucide-react'
import { Dialog } from '@/components/ui'
import { Button } from '@/components/ui'
import { SessionCard } from './SessionCard'
import { useCalendarStore } from '@/stores/calendarStore'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function PracticePlanDialog() {
  const plan = useCalendarStore((s) => s.activePlanPreview)
  const clearPreview = useCalendarStore((s) => s.clearActivePlanPreview)
  const addPlan = useCalendarStore((s) => s.addPlan)

  if (!plan) return null

  const avgMinutes = plan.sessions.length
    ? Math.round(plan.sessions.reduce((sum, s) => sum + s.totalMinutes, 0) / plan.sessions.length)
    : 0

  const handleAdd = () => {
    addPlan(plan)
    // clearActivePlanPreview is called inside addPlan
  }

  return (
    <Dialog open={!!plan} onClose={clearPreview} className="max-w-lg max-h-[70vh] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Music size={18} className="text-text-secondary shrink-0" />
          <h2 className="text-xl font-semibold text-text-primary">{plan.songTitle}</h2>
        </div>
        <button onClick={clearPreview} className="text-text-muted hover:text-text-secondary transition-colors shrink-0">
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-text-secondary mb-1">{plan.goalDescription}</p>
      <p className="text-xs text-text-muted mb-4">
        {plan.sessions.length} sessions · ~{avgMinutes} min each
      </p>

      <div className="border-t border-border my-2" />

      {/* Session list — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 py-2 flex flex-col gap-4">
        {plan.sessions.map((session, i) => (
          <div key={session.id}>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
              {formatDate(session.date)}
            </p>
            <SessionCard
              session={session}
              defaultExpanded={i < 2}
              interactive={false}
            />
          </div>
        ))}
      </div>

      <div className="border-t border-border my-2" />

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" size="sm" onClick={clearPreview}>
          Close
        </Button>
        <Button size="sm" onClick={handleAdd}>
          Add to Calendar
        </Button>
      </div>
    </Dialog>
  )
}
