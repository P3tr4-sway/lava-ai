import { useCallback, useEffect } from 'react'
import { usePracticeAssistStore } from '@/stores/practiceAssistStore'
import {
  buildPracticeSummary,
  type PracticeAssistSectionInput,
} from '@/utils/practiceAssist'

export function usePracticeAssist(
  songId: string | null | undefined,
  sections: PracticeAssistSectionInput[],
) {
  const mode = usePracticeAssistStore((s) => s.mode)
  const status = usePracticeAssistStore((s) => s.status)
  const summary = usePracticeAssistStore((s) => s.summary)
  const startReview = usePracticeAssistStore((s) => s.startReview)
  const retryPermission = usePracticeAssistStore((s) => s.retryPermission)
  const endReview = usePracticeAssistStore((s) => s.endReview)
  const clearReview = usePracticeAssistStore((s) => s.clearReview)
  const reset = usePracticeAssistStore((s) => s.reset)

  useEffect(() => {
    reset(songId ?? null)
    return () => reset(null)
  }, [reset, songId])

  const handleStartReview = useCallback(async () => {
    if (!songId) return
    await startReview(songId)
  }, [songId, startReview])

  const handleEndReview = useCallback(() => {
    endReview(buildPracticeSummary(sections))
  }, [endReview, sections])

  return {
    mode,
    status,
    summary,
    startReview: handleStartReview,
    retryPermission,
    endReview: handleEndReview,
    clearReview,
  }
}
