import { parseEnv } from './env.js'

const env = parseEnv()

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  llmProvider: env.LLM_PROVIDER,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  openaiApiKey: env.OPENAI_API_KEY,
  openaiModel: env.OPENAI_MODEL,
  openaiBaseUrl: env.OPENAI_BASE_URL,
  tencentVodSecretId: env.TENCENT_VOD_SECRET_ID,
  tencentVodSecretKey: env.TENCENT_VOD_SECRET_KEY,
  tencentVodSubAppId: env.TENCENT_VOD_SUB_APP_ID,
  tencentVodChatBaseUrl: env.TENCENT_VOD_CHAT_BASE_URL,
  databaseUrl: env.DATABASE_URL,
  clientOrigin: env.CLIENT_ORIGIN,
} as const
