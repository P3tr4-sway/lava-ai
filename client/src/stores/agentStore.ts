import { create } from 'zustand'
import type { AgentMessage, SpaceContext, ToolCall, ToolResult } from '@lava/shared'
import type { AgentWorkspacePreview } from '@/utils/agentWorkspace'

export interface AgentToolActivity {
  toolCallId: string
  name: string
  input: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  startedAt: number
  completedAt?: number
  result?: ToolResult
}

interface AgentThreadState {
  messages: AgentMessage[]
  toolActivities: AgentToolActivity[]
  isStreaming: boolean
  streamingContent: string
}

const EMPTY_THREAD: AgentThreadState = {
  messages: [],
  toolActivities: [],
  isStreaming: false,
  streamingContent: '',
}

interface AgentStore {
  threads: Record<string, AgentThreadState>
  activeThreadId: string
  messages: AgentMessage[]
  toolActivities: AgentToolActivity[]
  isStreaming: boolean
  streamingContent: string
  spaceContext: SpaceContext
  coachHighlightTarget: string | null
  workspacePreview: AgentWorkspacePreview | null

  setActiveThread: (threadId: string) => void
  hydrateThread: (threadId: string, thread: Partial<AgentThreadState>) => void
  addMessage: (msg: AgentMessage) => void
  replaceMessages: (messages: AgentMessage[]) => void
  updateMessage: (messageId: string, updater: (message: AgentMessage) => AgentMessage) => void
  startToolCall: (toolCall: ToolCall) => void
  completeToolCall: (toolResult: ToolResult) => void
  appendStreamDelta: (delta: string) => void
  setStreaming: (streaming: boolean) => void
  finalizeStream: () => void
  setSpaceContext: (ctx: SpaceContext) => void
  clearMessages: () => void
  setCoachHighlightTarget: (target: string | null) => void
  setWorkspacePreview: (preview: AgentWorkspacePreview) => void
  clearWorkspacePreview: () => void
}

function snapshotCurrentThread(state: Pick<AgentStore, 'messages' | 'toolActivities' | 'isStreaming' | 'streamingContent'>): AgentThreadState {
  return {
    messages: state.messages,
    toolActivities: state.toolActivities,
    isStreaming: state.isStreaming,
    streamingContent: state.streamingContent,
  }
}

export const useAgentStore = create<AgentStore>((set) => ({
  threads: { global: EMPTY_THREAD },
  activeThreadId: 'global',
  messages: [],
  toolActivities: [],
  isStreaming: false,
  streamingContent: '',
  spaceContext: { currentSpace: 'home', homeMode: 'discovery' },
  coachHighlightTarget: null,
  workspacePreview: null,

  setActiveThread: (threadId) =>
    set((state) => {
      if (state.activeThreadId === threadId) return {}

      const currentSnapshot = snapshotCurrentThread(state)
      const nextThread = state.threads[threadId] ?? EMPTY_THREAD

      return {
        activeThreadId: threadId,
        threads: {
          ...state.threads,
          [state.activeThreadId]: currentSnapshot,
          [threadId]: nextThread,
        },
        messages: nextThread.messages,
        toolActivities: nextThread.toolActivities,
        isStreaming: nextThread.isStreaming,
        streamingContent: nextThread.streamingContent,
      }
    }),

  hydrateThread: (threadId, thread) =>
    set((state) => {
      const nextThread: AgentThreadState = {
        ...EMPTY_THREAD,
        ...state.threads[threadId],
        ...thread,
      }

      if (state.activeThreadId !== threadId) {
        return {
          threads: {
            ...state.threads,
            [threadId]: nextThread,
          },
        }
      }

      return {
        threads: {
          ...state.threads,
          [threadId]: nextThread,
        },
        messages: nextThread.messages,
        toolActivities: nextThread.toolActivities,
        isStreaming: nextThread.isStreaming,
        streamingContent: nextThread.streamingContent,
      }
    }),

  addMessage: (msg) =>
    set((state) => {
      const messages = [...state.messages, msg]
      return {
        messages,
        threads: {
          ...state.threads,
          [state.activeThreadId]: {
            ...snapshotCurrentThread(state),
            messages,
          },
        },
      }
    }),

  replaceMessages: (messages) =>
    set((state) => ({
      messages,
      toolActivities: [],
      streamingContent: '',
      isStreaming: false,
      threads: {
        ...state.threads,
        [state.activeThreadId]: {
          messages,
          toolActivities: [],
          streamingContent: '',
          isStreaming: false,
        },
      },
    })),

  updateMessage: (messageId, updater) =>
    set((state) => {
      const messages = state.messages.map((message) =>
        message.id === messageId ? updater(message) : message,
      )
      return {
        messages,
        threads: {
          ...state.threads,
          [state.activeThreadId]: {
            ...snapshotCurrentThread(state),
            messages,
          },
        },
      }
    }),

  startToolCall: (toolCall) =>
    set((state) => {
      const toolActivities: AgentToolActivity[] = [
        ...state.toolActivities.filter((activity) => activity.toolCallId !== toolCall.id),
        {
          toolCallId: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
          status: 'running',
          startedAt: Date.now(),
        },
      ]
      return {
        toolActivities,
        threads: {
          ...state.threads,
          [state.activeThreadId]: {
            ...snapshotCurrentThread(state),
            toolActivities,
          },
        },
      }
    }),

  completeToolCall: (toolResult) =>
    set((state) => {
      const toolActivities: AgentToolActivity[] = state.toolActivities.map((activity) =>
        activity.toolCallId !== toolResult.toolCallId
          ? activity
          : {
              ...activity,
              status: toolResult.isError ? 'error' : 'done',
              completedAt: Date.now(),
              result: toolResult,
            },
      )
      return {
        toolActivities,
        threads: {
          ...state.threads,
          [state.activeThreadId]: {
            ...snapshotCurrentThread(state),
            toolActivities,
          },
        },
      }
    }),

  appendStreamDelta: (delta) =>
    set((state) => {
      const streamingContent = state.streamingContent + delta
      return {
        streamingContent,
        threads: {
          ...state.threads,
          [state.activeThreadId]: {
            ...snapshotCurrentThread(state),
            streamingContent,
          },
        },
      }
    }),

  setStreaming: (streaming) =>
    set((state) => ({
      isStreaming: streaming,
      threads: {
        ...state.threads,
        [state.activeThreadId]: {
          ...snapshotCurrentThread(state),
          isStreaming: streaming,
        },
      },
    })),

  finalizeStream: () =>
    set((state) => {
      if (!state.streamingContent) {
        return {
          isStreaming: false,
          threads: {
            ...state.threads,
            [state.activeThreadId]: {
              ...snapshotCurrentThread(state),
              isStreaming: false,
            },
          },
        }
      }
      const assistantMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: state.streamingContent,
        createdAt: Date.now(),
      }
      return {
        messages: [...state.messages, assistantMsg],
        streamingContent: '',
        isStreaming: false,
        threads: {
          ...state.threads,
          [state.activeThreadId]: {
            messages: [...state.messages, assistantMsg],
            toolActivities: state.toolActivities,
            streamingContent: '',
            isStreaming: false,
          },
        },
      }
    }),

  setSpaceContext: (ctx) => set({ spaceContext: ctx }),

  clearMessages: () =>
    set((state) => ({
      messages: [],
      toolActivities: [],
      streamingContent: '',
      isStreaming: false,
      threads: {
        ...state.threads,
        [state.activeThreadId]: EMPTY_THREAD,
      },
      workspacePreview: null,
    })),

  setCoachHighlightTarget: (target) => set({ coachHighlightTarget: target }),

  setWorkspacePreview: (preview) => set({ workspacePreview: preview }),

  clearWorkspacePreview: () => set({ workspacePreview: null }),
}))
