import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { agentService } from '@/services/agentService'
import type { AgentMessage, StreamEvent } from '@lava/shared'
import { SPACE_ROUTES } from '@lava/shared'

export function useAgent() {
  const navigate = useNavigate()
  const { addMessage, appendStreamDelta, setStreaming, finalizeStream, spaceContext } =
    useAgentStore()

  const sendMessage = async (content: string) => {
    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: Date.now(),
    }
    addMessage(userMsg)
    setStreaming(true)

    try {
      const allMessages = [...useAgentStore.getState().messages]

      await agentService.streamChat(allMessages, spaceContext, (event: StreamEvent) => {
        switch (event.type) {
          case 'text_delta':
            if (event.delta) appendStreamDelta(event.delta)
            break
          case 'tool_result':
            if (event.toolResult) {
              handleToolResult(event.toolResult.content)
            }
            break
          case 'message_stop':
            finalizeStream()
            break
        }
      })
    } catch (err) {
      finalizeStream()
      const errorMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: Date.now(),
      }
      addMessage(errorMsg)
    }
  }

  const handleToolResult = (resultContent: string) => {
    try {
      const result = JSON.parse(resultContent)
      if (result.action === 'navigate' && result.space) {
        const route = SPACE_ROUTES[result.space as keyof typeof SPACE_ROUTES]
        if (route) navigate(route)
      }
      if (result.action === 'practice_plan' && result.plan) {
        useCalendarStore.getState().setActivePlanPreview(result.plan)
      }
    } catch {
      // not a JSON result, ignore
    }
  }

  return { sendMessage }
}
