import type { AgentMessage } from '@lava/shared'
import type { NormalizedMessage } from './providers/types.js'

const MAX_HISTORY = 20

export class ConversationManager {
  normalize(messages: AgentMessage[]): NormalizedMessage[] {
    return messages
      .slice(-MAX_HISTORY)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
  }
}
