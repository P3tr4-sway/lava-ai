// client/src/components/calendar/UpcomingPractice.tsx
import { useNavigate } from 'react-router-dom'
import { Circle, ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useCalendarStore } from '@/stores/calendarStore'
import type { PracticeSession, PracticePlan } from '@/stores/calendarStore'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDayLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isToday(dateStr: string): boolean {
  return dateStr === todayStr()
}

interface UpcomingSession {
  session: PracticeSession
  plan: PracticePlan
}

export function UpcomingPractice() {
  const navigate = useNavigate()
  const plans = useCalendarStore((s) => s.plans)
  const setActivePlanPreview = useCalendarStore((s) => s.setActivePlanPreview)

  // Collect upcoming incomplete sessions across all plans
  const today = todayStr()
  const upcoming: UpcomingSession[] = []

  for (const plan of plans) {
    for (const session of plan.sessions) {
      if (!session.completed && session.date >= today) {
        upcoming.push({ session, plan })
      }
    }
  }

  // Sort by date, then timeOfDay priority
  const timeOrder = { morning: 0, afternoon: 1, evening: 2 }
  upcoming.sort((a, b) => {
    const dateCmp = a.session.date.localeCompare(b.session.date)
    if (dateCmp !== 0) return dateCmp
    const aTime = timeOrder[a.session.timeOfDay as keyof typeof timeOrder] ?? 1
    const bTime = timeOrder[b.session.timeOfDay as keyof typeof timeOrder] ?? 1
    return aTime - bTime
  })

  const visible = upcoming.slice(0, 5)

  if (visible.length === 0) return null

  // Group by date for day labels
  let lastDate = ''

  return (
    <section>
      <p className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
        Upcoming Practice
      </p>
      <div className="border-t border-border pt-3 flex flex-col gap-1">
        {visible.map(({ session, plan }) => {
          const showDayLabel = session.date !== lastDate
          lastDate = session.date

          return (
            <div key={session.id}>
              {showDayLabel && (
                <p className="text-xs text-text-muted mt-2 first:mt-0 mb-1">
                  {formatDayLabel(session.date)}
                </p>
              )}
              <button
                onClick={() => setActivePlanPreview(plan)}
                className="w-full flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-surface-1 transition-colors text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Circle
                    size={8}
                    className={cn(
                      'shrink-0',
                      isToday(session.date) ? 'text-text-primary fill-current' : 'text-text-muted',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{session.title}</p>
                    <p className="text-xs text-text-muted truncate">{plan.songTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-text-secondary">{session.totalMinutes} min</span>
                  <ChevronRight size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={() => navigate('/calendar')}
        className="mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        View full calendar →
      </button>
    </section>
  )
}
