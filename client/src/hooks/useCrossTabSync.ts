import { useEffect } from 'react'
import { crossTabSync } from '@/services/crossTabSync'
import type { SyncMessage } from '@/services/crossTabSync'
import { queryCache } from '@/services/queryCache'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'

// ─── Anti-loop flag ──────────────────────────────────────────────────────────
//
// When a message arrives from another tab we need to update our local stores
// WITHOUT re-broadcasting the same change back. Stores can check
// `isReceivingBroadcast()` before calling `crossTabSync.broadcast()`.

let _receivingBroadcast = false

/**
 * Returns `true` when the current store mutation was triggered by a
 * BroadcastChannel message from another tab. Stores should skip their
 * own `crossTabSync.broadcast()` call when this returns `true` to
 * avoid infinite broadcast loops.
 *
 * @example
 * ```ts
 * // Inside a store action:
 * import { isReceivingBroadcast } from '@/hooks/useCrossTabSync'
 * import { crossTabSync } from '@/services/crossTabSync'
 *
 * upsertProject: (project) => {
 *   set(state => { ... })
 *   if (!isReceivingBroadcast()) {
 *     crossTabSync.broadcast({ type: 'project-updated', projectId: project.id })
 *   }
 * }
 * ```
 */
export function isReceivingBroadcast(): boolean {
  return _receivingBroadcast
}

// ─── Message handler ─────────────────────────────────────────────────────────

function handleMessage(message: SyncMessage): void {
  _receivingBroadcast = true

  try {
    switch (message.type) {
      case 'cache-invalidate':
        handleCacheInvalidation(message.keys)
        break

      case 'theme-change':
        // Apply theme from the other tab without re-broadcasting
        useUIStore.getState().setTheme(message.theme)
        break

      case 'project-updated':
        // Another tab saved/updated a project — refetch the full list
        void useProjectStore.getState().loadProjects()
        break

      case 'project-deleted':
        // Remove from local state immediately, then refetch for consistency
        useProjectStore.getState().removeProject(message.projectId)
        void useProjectStore.getState().loadProjects()
        break
    }
  } finally {
    _receivingBroadcast = false
  }
}

/**
 * Invalidate query cache entries for each key received from another tab.
 * queryCache is imported directly since it exists as a singleton in this
 * codebase. If the module is ever removed, this import will produce a
 * build error (intentional — keeps sync in lockstep with the cache).
 */
function handleCacheInvalidation(keys: string[]): void {
  for (const key of keys) {
    queryCache.invalidate(key)
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Wires up cross-tab synchronization to the app's Zustand stores.
 *
 * Call this hook once in a top-level component (e.g. `App.tsx` or a
 * root layout component):
 *
 * ```tsx
 * // In App.tsx or RootLayout.tsx:
 * import { useCrossTabSync } from '@/hooks/useCrossTabSync'
 *
 * export function App() {
 *   useCrossTabSync()
 *   // ...rest of the app
 * }
 * ```
 */
export function useCrossTabSync(): void {
  useEffect(() => {
    crossTabSync.init()
    const unsubscribe = crossTabSync.onMessage(handleMessage)

    return () => {
      unsubscribe()
      crossTabSync.destroy()
    }
  }, [])
}
