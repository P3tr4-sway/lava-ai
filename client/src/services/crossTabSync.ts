// ─── Cross-tab synchronization via BroadcastChannel ─────────────────────────
//
// Keeps multiple browser tabs in sync for cache invalidation, theme changes,
// and project mutations. Uses the BroadcastChannel API which only delivers
// messages to OTHER tabs (the sender never receives its own message).
//
// ─── Integration ─────────────────────────────────────────────────────────────
//
// Stores should broadcast after mutations, e.g. in projectStore.ts:
//
//   import { crossTabSync } from '@/services/crossTabSync'
//
//   // After saving a project:
//   crossTabSync.broadcast({ type: 'project-updated', projectId: project.id })
//
//   // After deleting a project:
//   crossTabSync.broadcast({ type: 'project-deleted', projectId })
//
//   // After changing theme in uiStore.ts:
//   crossTabSync.broadcast({ type: 'theme-change', theme })
//
//   // After any API mutation that should bust the cache:
//   crossTabSync.invalidateCache(['/projects', '/projects/*'])
//

export type SyncMessage =
  | { type: 'cache-invalidate'; keys: string[] }
  | { type: 'theme-change'; theme: 'system' | 'light' | 'dark' }
  | { type: 'project-updated'; projectId: string }
  | { type: 'project-deleted'; projectId: string }

const CHANNEL_NAME = 'lava-sync'

type MessageHandler = (message: SyncMessage) => void

let channel: BroadcastChannel | null = null
const handlers = new Set<MessageHandler>()

function isSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined'
}

function dispatch(event: MessageEvent<SyncMessage>) {
  const message = event.data
  for (const handler of handlers) {
    handler(message)
  }
}

export const crossTabSync = {
  /** Initialize the BroadcastChannel. Call once at app startup. */
  init(): void {
    if (!isSupported() || channel !== null) return

    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = dispatch
  },

  /** Send a message to all other tabs. */
  broadcast(message: SyncMessage): void {
    if (!channel) return
    channel.postMessage(message)
  },

  /**
   * Register a handler for incoming messages from other tabs.
   * Returns an unsubscribe function.
   */
  onMessage(handler: MessageHandler): () => void {
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  },

  /** Convenience: broadcast cache invalidation for the given keys. */
  invalidateCache(keys: string[]): void {
    if (keys.length === 0) return
    this.broadcast({ type: 'cache-invalidate', keys })
  },

  /** Destroy the channel and remove all handlers. */
  destroy(): void {
    if (channel) {
      channel.onmessage = null
      channel.close()
      channel = null
    }
    handlers.clear()
  },
}
