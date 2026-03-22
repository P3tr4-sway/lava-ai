import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'

export function useRequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthPrompt = useUIStore((s) => s.openAuthPrompt)

  const requireAuth = (action?: string): boolean => {
    if (isAuthenticated) return true
    openAuthPrompt(action)
    return false
  }

  return { isAuthenticated, requireAuth }
}
