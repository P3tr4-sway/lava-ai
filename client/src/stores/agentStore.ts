import { create } from 'zustand'
import type { AgentMessage, SpaceContext } from '@lava/shared'

interface AgentStore {
  messages: AgentMessage[]
  isStreaming: boolean
  streamingContent: string
  spaceContext: SpaceContext
  coachHighlightTarget: string | null

  addMessage: (msg: AgentMessage) => void
  appendStreamDelta: (delta: string) => void
  setStreaming: (streaming: boolean) => void
  finalizeStream: () => void
  setSpaceContext: (ctx: SpaceContext) => void
  clearMessages: () => void
  setCoachHighlightTarget: (target: string | null) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  spaceContext: { currentSpace: 'learn' },
  coachHighlightTarget: null,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  appendStreamDelta: (delta) =>
    set((state) => ({ streamingContent: state.streamingContent + delta })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  finalizeStream: () =>
    set((state) => {
      if (!state.streamingContent) return { isStreaming: false }
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
      }
    }),

  setSpaceContext: (ctx) => set({ spaceContext: ctx }),

  clearMessages: () => set({ messages: [], streamingContent: '' }),

  setCoachHighlightTarget: (target) => set({ coachHighlightTarget: target }),
}))
