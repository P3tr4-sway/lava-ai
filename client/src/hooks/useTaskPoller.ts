// client/src/hooks/useTaskPoller.ts
import { useEffect, useRef } from 'react'
import { useTaskStore, STAGE_PROGRESS } from '@/stores/taskStore'
import { youtubeService } from '@/services/youtubeService'

const POLL_INTERVAL = 2000

/**
 * Mount this once in AppShell.
 * Polls all active tasks every 2s, regardless of which page is visible.
 */
export function useTaskPoller() {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const activeTasks = tasks.filter((t) => t.status === 'active')
  const activeTasksRef = useRef(activeTasks)
  activeTasksRef.current = activeTasks

  useEffect(() => {
    const poll = async () => {
      const current = activeTasksRef.current
      if (current.length === 0) return

      await Promise.allSettled(
        current.map(async (task) => {
          try {
            const result = await youtubeService.pollAnalysis(task.id)

            if (result.status === 'completed') {
              updateTask(task.id, {
                status: 'completed',
                stage: 'completed',
                progress: 100,
                completedAt: Date.now(),
                result,
              })
            } else if (result.status === 'error') {
              updateTask(task.id, {
                status: 'error',
                stage: 'error',
                error: result.error ?? 'Analysis failed',
              })
            } else {
              updateTask(task.id, {
                stage: result.status,
                progress: STAGE_PROGRESS[result.status],
              })
            }
          } catch {
            // Network error — keep polling, don't update state
          }
        }),
      )
    }

    const timer = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [updateTask])
}
