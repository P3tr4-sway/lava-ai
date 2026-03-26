import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LLM_PROVIDER: z.enum(['claude', 'openai']).default('claude'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.1'),
  OPENAI_BASE_URL: z.string().optional(),
  TENCENT_VOD_SECRET_ID: z.string().optional(),
  TENCENT_VOD_SECRET_KEY: z.string().optional(),
  TENCENT_VOD_SUB_APP_ID: z.coerce.number().int().positive().optional(),
  TENCENT_VOD_CHAT_BASE_URL: z.string().default('https://text-aigc.vod-qcloud.com/v1'),
  DATABASE_URL: z.string().default('./data/lava.db'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors)
    process.exit(1)
  }
  return result.data
}
