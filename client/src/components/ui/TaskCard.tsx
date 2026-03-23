// client/src/components/ui/TaskCard.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, RotateCcw, X, ChevronRight } from 'lucide-react'
import { cn } from './utils'
import { useTaskStore, STAGE_LABEL } from '@/stores/taskStore'
import type { BackgroundTask } from '@/stores/taskStore'
import { youtubeService } from '@/services/youtubeService'

interface TaskCardProps {
  task: BackgroundTask
  className?: string
}

export function TaskCard({ task, className }: TaskCardProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const removeTask = useTaskStore((s) => s.removeTask)
  const addTask = useTaskStore((s) => s.addTask)
  const cardRef = useRef<HTMLDivElement>(null)

  // Collapse on outside click when expanded
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  // Keyboard dismiss
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded])

  const [, setTick] = useState(0)

  useEffect(() => {
    if (!expanded || task.status !== 'active') return
    const timer = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [expanded, task.status])

  const elapsed = task.completedAt
    ? null
    : `${Math.floor((Date.now() - task.createdAt) / 60000)}:${String(Math.floor(((Date.now() - task.createdAt) % 60000) / 1000)).padStart(2, '0')}`

  const handleViewResults = useCallback(() => {
    navigate(`/play/${task.id}?generate=1`)
    removeTask(task.id)
  }, [navigate, task.id, removeTask])

  const handleRetry = useCallback(async () => {
    removeTask(task.id)
    try {
      // Use task.videoId (original YouTube video ID), NOT task.id (transcriptionId)
      const newId = await youtubeService.startAnalysis(task.videoId, task.title)
      addTask(newId, task.videoId, task.title)
    } catch {
      // Swallow — user can try again
    }
  }, [task.id, task.videoId, task.title, removeTask, addTask])

  const isActive = task.status === 'active'
  const isCompleted = task.status === 'completed'
  const isError = task.status === 'error'

  return (
    <div
      ref={cardRef}
      role="status"
      aria-live="polite"
      aria-label={`${task.title} — ${isCompleted ? 'Complete' : isError ? 'Error' : STAGE_LABEL[task.stage]}`}
      className={cn(
        'w-72 bg-surface-1 border border-border rounded-lg shadow-lg overflow-hidden',
        'transition-all duration-200 ease-out',
        className,
      )}
    >
      {/* Header row */}
      <button
        onClick={() => isActive && setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 pt-3',
          isActive ? 'cursor-pointer pb-2' : 'cursor-default pb-3',
        )}
        disabled={!isActive}
      >
        {/* Status icon */}
        <span className="shrink-0">
          {isActive && <Loader2 size={14} className="animate-spin text-text-secondary" />}
          {isCompleted && <CheckCircle2 size={14} className="text-success" />}
          {isError && <XCircle size={14} className="text-error" />}
        </span>

        {/* Title */}
        <span className="flex-1 text-xs font-medium text-text-primary truncate text-left">
          {task.title}
        </span>

        {/* Right label */}
        {isActive && (
          <span className="shrink-0 text-xs text-text-muted tabular-nums">
            {task.progress}%
          </span>
        )}
        {isCompleted && (
          <span className="shrink-0 text-xs text-success font-medium">Complete</span>
        )}
        {isError && (
          <span className="shrink-0 text-xs text-error font-medium">Error</span>
        )}
        {isActive && (
          <ChevronRight
            size={12}
            className={cn(
              'shrink-0 text-text-muted transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
      </button>

      {/* Progress bar — active only */}
      {isActive && (
        <div className="px-3 pb-2.5">
          <div className="w-full h-0.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Full progress bar — completed */}
      {isCompleted && (
        <div className="px-3 pb-3">
          <div className="w-full h-0.5 bg-accent rounded-full" />
        </div>
      )}

      {/* Expanded detail — active only */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-150 ease-out',
          expanded && isActive ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border pt-2">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>{STAGE_LABEL[task.stage]}</span>
            {elapsed && <span className="text-text-muted tabular-nums">{elapsed}</span>}
          </div>
          <button
            onClick={() => navigate(`/play/${task.id}?generate=1`)}
            className="self-end flex items-center gap-1 text-xs font-medium text-text-primary hover:text-accent transition-colors"
          >
            View Page <ChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* Completed actions */}
      {isCompleted && (
        <div className="px-3 pb-3 flex items-center justify-between gap-2 border-t border-border pt-2">
          <button
            onClick={handleViewResults}
            className="flex-1 text-xs font-medium text-text-primary bg-surface-3 hover:bg-surface-4 rounded px-2 py-1.5 transition-colors text-center"
          >
            View Results
          </button>
          <button
            onClick={() => removeTask(task.id)}
            aria-label="Dismiss"
            className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Error actions */}
      {isError && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-xs text-error truncate">{task.error}</p>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-xs font-medium text-text-primary bg-surface-3 hover:bg-surface-4 rounded px-2 py-1.5 transition-colors"
            >
              <RotateCcw size={11} /> Retry
            </button>
            <button
              onClick={() => removeTask(task.id)}
              aria-label="Dismiss"
              className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
