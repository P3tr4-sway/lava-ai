import { Link } from 'react-router-dom'
import { cn } from '@/components/ui/utils'
import { STAGE_LABEL, useTaskStore } from '@/stores/taskStore'

interface NotificationPanelProps {
  className?: string
  onClose?: () => void
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

export function NotificationPanel({ className, onClose }: NotificationPanelProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const removeTask = useTaskStore((s) => s.removeTask)
  const visibleTasks = tasks.slice(0, 4)

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className={cn(
        'w-[min(360px,calc(100vw-2rem))] rounded-[24px] border border-border bg-surface-0 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <p className="text-[15px] font-medium text-text-primary">Notifications</p>
        {tasks.length > 0 ? (
          <button
            type="button"
            onClick={() => tasks.forEach((task) => removeTask(task.id))}
            className="text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="h-px bg-border" />

      {visibleTasks.length > 0 ? (
        <div className="flex flex-col">
          {visibleTasks.map((task, index) => {
            const statusLabel =
              task.status === 'completed'
                ? 'Ready'
                : task.status === 'error'
                  ? 'Needs attention'
                  : STAGE_LABEL[task.stage]

            return (
              <div key={task.id} className={cn('px-5 py-4', index < visibleTasks.length - 1 && 'border-b border-border')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                    <p className="mt-1 text-sm leading-5 text-text-secondary">{statusLabel}</p>
                    {task.error ? (
                      <p className="mt-1 line-clamp-1 text-sm leading-5 text-text-secondary">{task.error}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-text-muted">{formatTime(task.completedAt ?? task.createdAt)}</p>
                    {task.status === 'active' ? (
                      <p className="mt-1 text-xs font-medium text-text-secondary">{task.progress}%</p>
                    ) : null}
                  </div>
                </div>

                {task.status === 'active' ? (
                  <div className="mt-3 h-px bg-border">
                    <div className="h-px bg-text-primary transition-all duration-500" style={{ width: `${task.progress}%` }} />
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <Link
                    to={`/play/${task.id}?generate=1`}
                    onClick={onClose}
                    className="text-xs font-medium text-text-primary transition-colors hover:text-text-secondary"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="text-xs text-text-muted transition-colors hover:text-text-primary"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-5 py-8">
          <p className="text-sm text-text-secondary">No notifications</p>
        </div>
      )}
    </div>
  )
}
