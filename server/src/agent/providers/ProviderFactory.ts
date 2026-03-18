import type { LLMProvider } from './types.js'
import { ClaudeProvider } from './ClaudeProvider.js'
import { OpenAIProvider } from './OpenAIProvider.js'
import { config } from '../../config/index.js'

export function createProvider(): LLMProvider {
  switch (config.llmProvider) {
    case 'openai':
      return new OpenAIProvider()
    case 'claude':
    default:
      return new ClaudeProvider()
  }
}
