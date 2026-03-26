// client/src/components/calendar/DayRow.tsx
import { cn } from '@/components/ui/utils'
import { SessionCard } from './SessionCard'
import { Trash2 } from 'lucide-react'
import type { PracticeSession, PracticePlan } from '@/stores/calendarStore'
import { useCalendarStore } from '@/stores/calendarStore'

interface SessionWithPlan {
  session: PracticeSession
  plan: PracticePlan
}

interface DayRowProps {
  date: Date
  sessions: SessionWithPlan[]
  isToday: boolean
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() + ' ' + date.getDate()
}

export function DayRow({ date, sessions, isToday }: DayRowProps) {
  const toggleSubTaskComplete = useCalendarStore((s) => s.toggleSubTaskComplete)
  const setActivePlanPreview = useCalendarStore((s) => s.setActivePlanPreview)
  const removePlan = useCalendarStore((s) => s.removePlan)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPast = date < today

  return (
    <div className={cn('py-2', isToday && 'bg-surface-1 -mx-6 px-6 rounded-lg')}>
      <p className={cn(
        'text-xs font-medium uppercase tracking-wide mb-2',
        isToday ? 'text-text-primary' : 'text-text-muted',
        isPast && !isToday && 'text-warning',
      )}>
        {formatDayLabel(date)}
        {isToday && <span className="ml-1.5 normal-case">· Today</span>}
      </p>

      {sessions.length === 0 ? (
        <div className="h-1" />
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(({ session, plan }) => (
            <div
              key={session.id}
              className="bg-surface-2 border border-border rounded-lg p-3 group"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <button
                  onClick={() => setActivePlanPreview(plan)}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors truncate"
                >
                  {plan.songTitle}
                </button>
                <button
                  onClick={() => removePlan(plan.id)}
                  className="text-text-muted hover:text-error transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Remove plan"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <SessionCard
                session={session}
                defaultExpanded={isToday}
                interactive={true}
                onToggleSubTask={(subtaskId) =>
                  toggleSubTaskComplete(plan.id, session.id, subtaskId)
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
