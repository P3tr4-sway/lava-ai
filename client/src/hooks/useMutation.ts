import { useState, useRef, useCallback } from 'react'
import { queryCache } from '@/services/queryCache'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseMutationOptions<TData, TVariables> {
  /** Called after the mutation succeeds */
  onSuccess?: (data: TData, variables: TVariables) => void
  /** Called if the mutation throws */
  onError?: (error: Error, variables: TVariables) => void
  /** Cache keys to invalidate after a successful mutation */
  invalidateKeys?: string[]
}

interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>
  isLoading: boolean
  error: Error | null
  reset: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TVariables>,
): UseMutationResult<TData, TVariables> {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Keep latest refs so the callback never goes stale
  const mutationFnRef = useRef(mutationFn)
  const optionsRef = useRef(options)
  mutationFnRef.current = mutationFn
  optionsRef.current = options

  const mutate = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await mutationFnRef.current(variables)

      // Invalidate cache keys on success
      const keys = optionsRef.current?.invalidateKeys
      if (keys) {
        for (const key of keys) {
          queryCache.invalidate(key)
        }
      }

      optionsRef.current?.onSuccess?.(data, variables)

      return data
    } catch (err) {
      const normalised = err instanceof Error ? err : new Error(String(err))
      setError(normalised)
      optionsRef.current?.onError?.(normalised, variables)
      throw normalised
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setIsLoading(false)
  }, [])

  return { mutate, isLoading, error, reset }
}
