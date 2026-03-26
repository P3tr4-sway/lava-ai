// client/src/spaces/calendar/CalendarPage.tsx
import { useState } from 'react'
import { WeekView } from '@/components/calendar/WeekView'
import { DayRow } from '@/components/calendar/DayRow'
import { useCalendarStore } from '@/stores/calendarStore'

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

export function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const plans = useCalendarStore((s) => s.plans)

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Build 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    return date
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toDateStr(today)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-12">
        <WeekView weekStart={weekStart} onPrevWeek={prevWeek} onNextWeek={nextWeek} />

        <div className="flex flex-col gap-1">
          {days.map((date) => {
            const dateStr = toDateStr(date)
            const isToday = dateStr === todayStr

            // Collect sessions for this day across all plans
            const sessionsForDay = plans.flatMap((plan) =>
              plan.sessions
                .filter((s) => s.date === dateStr)
                .map((session) => ({ session, plan })),
            )

            // Sort by timeOfDay
            const timeOrder = { morning: 0, afternoon: 1, evening: 2 }
            sessionsForDay.sort((a, b) => {
              const aT = timeOrder[a.session.timeOfDay as keyof typeof timeOrder] ?? 1
              const bT = timeOrder[b.session.timeOfDay as keyof typeof timeOrder] ?? 1
              return aT - bT
            })

            return (
              <DayRow
                key={dateStr}
                date={date}
                sessions={sessionsForDay}
                isToday={isToday}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
