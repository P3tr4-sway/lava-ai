// client/src/components/calendar/WeekView.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'

interface WeekViewProps {
  weekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
}

function formatWeekRange(start: Date): string {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

function isCurrentWeek(start: Date): boolean {
  const now = new Date()
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return now >= start && now <= end
}

export function WeekView({ weekStart, onPrevWeek, onNextWeek }: WeekViewProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-text-primary">Calendar</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onPrevWeek}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onNextWeek}>
          <ChevronRight size={16} />
        </Button>
        <div className="text-sm text-text-secondary ml-1">
          {isCurrentWeek(weekStart) && <span className="mr-1.5">This Week</span>}
          <span>{formatWeekRange(weekStart)}</span>
        </div>
      </div>
    </div>
  )
}
