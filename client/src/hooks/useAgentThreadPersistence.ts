import { useEffect, useMemo, useRef } from 'react'
import type { AgentMessage } from '@lava/shared'
import { useAgentStore } from '@/stores/agentStore'

const STORAGE_PREFIX = 'lava-agent-thread:v1:play:'
const MAX_PERSISTED_MESSAGES = 100

interface PersistedAgentThread {
  version: 1
  messages: AgentMessage[]
}

function getThreadStorageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId}`
}

function isPersistedMessage(value: unknown): value is AgentMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AgentMessage>
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'assistant' || candidate.role === 'tool') &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'number'
  )
}

function readPersistedThread(storageKey: string): AgentMessage[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []

    const parsed = JSON.parse(raw) as Partial<PersistedAgentThread>
    if (parsed.version !== 1 || !Array.isArray(parsed.messages)) return []

    return parsed.messages.filter(isPersistedMessage)
  } catch {
    return []
  }
}

function writePersistedThread(storageKey: string, messages: AgentMessage[]) {
  const payload: PersistedAgentThread = {
    version: 1,
    messages: messages.filter((message) => !message.localOnly).slice(-MAX_PERSISTED_MESSAGES),
  }
  localStorage.setItem(storageKey, JSON.stringify(payload))
}

export function useAgentThreadPersistence(projectId?: string) {
  const setActiveThread = useAgentStore((s) => s.setActiveThread)
  const replaceMessages = useAgentStore((s) => s.replaceMessages)
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const skipNextPersistRef = useRef(false)

  const storageKey = projectId ? getThreadStorageKey(projectId) : null
  const persistedMessages = useMemo(
    () => (storageKey ? readPersistedThread(storageKey) : []),
    [storageKey],
  )
  const hasPersistedThread = persistedMessages.length > 0

  useEffect(() => {
    if (!storageKey) return

    setActiveThread(`play:${projectId}`)

    // 切歌时先加载对应 thread，避免把上一首歌的上下文串到新页面。
    skipNextPersistRef.current = true
    replaceMessages(persistedMessages)
  }, [persistedMessages, projectId, replaceMessages, setActiveThread, storageKey])

  useEffect(() => {
    if (!storageKey || isStreaming) return

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }

    try {
      if (messages.length === 0) {
        localStorage.removeItem(storageKey)
        return
      }

      writePersistedThread(storageKey, messages)
    } catch {
      // Local persistence is best-effort; chat should keep working even if storage is unavailable.
    }
  }, [isStreaming, messages, storageKey])

  return { hasPersistedThread }
}
