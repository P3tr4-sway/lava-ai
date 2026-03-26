// client/src/components/calendar/SessionCard.tsx
import { useState } from 'react'
import { ChevronRight, Circle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import type { PracticeSession } from '@/stores/calendarStore'

interface SessionCardProps {
  session: PracticeSession
  defaultExpanded?: boolean
  interactive?: boolean // subtask checkboxes clickable
  onToggleSubTask?: (subtaskId: string) => void
  className?: string
}

export function SessionCard({
  session,
  defaultExpanded = false,
  interactive = false,
  onToggleSubTask,
  className,
}: SessionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className={cn('rounded-lg', className)}>
      {/* Session header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {session.completed ? (
            <CheckCircle2 size={14} className="text-success shrink-0" />
          ) : (
            <Circle size={14} className="text-text-muted shrink-0" />
          )}
          <span
            className={cn(
              'text-base font-medium truncate',
              session.completed ? 'text-text-muted line-through' : 'text-text-primary',
            )}
          >
            {session.title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-secondary">{session.totalMinutes} min</span>
          <ChevronRight
            size={14}
            className={cn(
              'text-text-muted transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </div>
      </button>

      {/* Subtasks */}
      {expanded && session.subtasks.length > 0 && (
        <div className="mt-2 ml-5 flex flex-col gap-1.5">
          {session.subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2">
              {interactive ? (
                <button
                  onClick={() => onToggleSubTask?.(st.id)}
                  className="shrink-0"
                >
                  {st.completed ? (
                    <CheckCircle2 size={12} className="text-success" />
                  ) : (
                    <Circle size={12} className="text-text-muted hover:text-text-secondary transition-colors" />
                  )}
                </button>
              ) : (
                <Circle size={12} className="text-text-muted shrink-0" />
              )}
              <span
                className={cn(
                  'text-sm',
                  st.completed ? 'text-text-muted line-through' : 'text-text-secondary',
                )}
              >
                {st.title}
              </span>
              <span className="text-xs text-text-muted">{st.durationMinutes} min</span>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed subtask count */}
      {!expanded && session.subtasks.length > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 ml-5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {session.subtasks.length} subtasks
        </button>
      )}
    </div>
  )
}
