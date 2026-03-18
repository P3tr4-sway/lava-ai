import { parseEnv } from './env.js'

const env = parseEnv()

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  llmProvider: env.LLM_PROVIDER,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  openaiApiKey: env.OPENAI_API_KEY,
  databaseUrl: env.DATABASE_URL,
  clientOrigin: env.CLIENT_ORIGIN,
} as const
