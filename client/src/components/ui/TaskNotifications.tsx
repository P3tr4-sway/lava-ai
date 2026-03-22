import { useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { TaskCard } from './TaskCard'
import { cn } from './utils'

const MAX_VISIBLE = 3

export function TaskNotifications({ className }: { className?: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const [showAll, setShowAll] = useState(false)

  if (tasks.length === 0) return null

  const visible = showAll ? tasks : tasks.slice(0, MAX_VISIBLE)
  const overflow = tasks.length - MAX_VISIBLE

  return (
    <div
      role="region"
      aria-label="Background tasks"
      className={cn(
        'fixed top-4 right-4 z-50 flex flex-col gap-2',
        className,
      )}
    >
      {visible.map((task) => (
        <div
          key={task.id}
          className="animate-slide-in-right"
        >
          <TaskCard task={task} />
        </div>
      ))}

      {!showAll && overflow > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="self-end text-xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1"
        >
          +{overflow} more
        </button>
      )}
    </div>
  )
}
