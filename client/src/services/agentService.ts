import type { AgentMessage, SpaceContext, StreamEvent } from '@lava/shared'

export const agentService = {
  async streamChat(
    messages: AgentMessage[],
    spaceContext: SpaceContext,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void> {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, spaceContext }),
    })

    if (!res.ok) {
      throw new Error(`Agent request failed: ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            onEvent({ type: 'message_stop' })
            return
          }
          try {
            const event: StreamEvent = JSON.parse(data)
            onEvent(event)
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    }

    onEvent({ type: 'message_stop' })
  },
}
