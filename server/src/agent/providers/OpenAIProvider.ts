import OpenAI from 'openai'
import type { LLMProvider, NormalizedMessage } from './types.js'
import type { StreamEvent, ToolCall, ToolDefinition } from '@lava/shared'
import { config } from '../../config/index.js'
import { createTencentVodApiToken } from './tencentVodAuth.js'

const TENCENT_VOD_TOKEN_WARMUP_MS = 35_000

export class OpenAIProvider implements LLMProvider {
  private tencentVodApiToken: string | null = null
  private tencentVodApiTokenIssuedAt = 0
  private tencentVodApiTokenPromise: Promise<string> | null = null

  async stream(
    messages: NormalizedMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void> {
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const oaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            t.parameters.map((p) => [
              p.name,
              {
                type: p.type,
                description: p.description,
                ...(p.enum ? { enum: p.enum } : {}),
                ...(p.type === 'array' && p.items ? { items: p.items } : {}),
              },
            ]),
          ),
          required: t.parameters.filter((p) => p.required).map((p) => p.name),
        },
      },
    }))

    const requestBody: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: config.openaiModel,
      messages: oaiMessages,
      tools: oaiTools.length > 0 ? oaiTools : undefined,
      stream: true,
      ...(this.shouldUseTencentVod() ? {} : { stream_options: { include_usage: true } }),
    }

    const stream = await this.createChatCompletionStream(requestBody)

    const toolCalls = new Map<number, ToolCall>()
    const toolArgs = new Map<number, string>()
    let isFinished = false

    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      const delta = choice?.delta

      if (delta?.content) {
        onEvent({ type: 'text_delta', delta: delta.content })
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCalls.get(tc.index) ?? { id: '', name: '', input: {} }
          existing.id = tc.id ?? existing.id
          existing.name = tc.function?.name ?? existing.name
          toolCalls.set(tc.index, existing)

          if (tc.function?.arguments) {
            toolArgs.set(tc.index, `${toolArgs.get(tc.index) ?? ''}${tc.function.arguments}`)
          }
        }
      }

      if (!isFinished && choice?.finish_reason === 'tool_calls') {
        for (const [index, toolCall] of toolCalls.entries()) {
          const rawArguments = toolArgs.get(index) ?? '{}'
          toolCall.input = safeParseToolArguments(rawArguments)
          onEvent({ type: 'tool_start', toolCall })
        }
        isFinished = true
        onEvent({ type: 'message_stop' })
      }

      if (!isFinished && choice?.finish_reason === 'stop') {
        isFinished = true
        onEvent({ type: 'message_stop' })
      }
    }
  }

  private shouldUseTencentVod(): boolean {
    return Boolean(config.tencentVodSecretId && config.tencentVodSecretKey && config.tencentVodSubAppId)
  }

  private async createChatCompletionStream(body: OpenAI.Chat.ChatCompletionCreateParamsStreaming) {
    try {
      const client = await this.createClient()
      return await client.chat.completions.create(body)
    } catch (error) {
      if (this.shouldRetryWithFreshTencentToken(error)) {
        await this.recoverTencentVodToken()
        const client = await this.createClient()
        return client.chat.completions.create(body)
      }
      throw error
    }
  }

  private shouldRetryWithFreshTencentToken(error: unknown): boolean {
    if (!this.shouldUseTencentVod()) return false
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined
    return status === 401 || status === 403
  }

  private async createClient(): Promise<OpenAI> {
    if (this.shouldUseTencentVod()) {
      const apiKey = await this.getTencentVodApiToken()
      return new OpenAI({
        apiKey,
        baseURL: config.tencentVodChatBaseUrl,
      })
    }

    if (!config.openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY is required when LLM_PROVIDER=openai and Tencent VOD credentials are not configured',
      )
    }

    return new OpenAI({
      apiKey: config.openaiApiKey,
      ...(config.openaiBaseUrl ? { baseURL: config.openaiBaseUrl } : {}),
    })
  }

  private async getTencentVodApiToken(): Promise<string> {
    if (this.tencentVodApiToken) {
      return this.tencentVodApiToken
    }

    // Concurrent requests share the same in-flight fetch so we only call
    // CreateAigcApiToken once even if multiple requests arrive simultaneously.
    if (!this.tencentVodApiTokenPromise) {
      if (!config.tencentVodSecretId || !config.tencentVodSecretKey || !config.tencentVodSubAppId) {
        throw new Error('Tencent VOD credentials are incomplete')
      }

      this.tencentVodApiTokenPromise = createTencentVodApiToken({
        secretId: config.tencentVodSecretId,
        secretKey: config.tencentVodSecretKey,
        subAppId: config.tencentVodSubAppId,
      })
        .then((token) => {
          this.tencentVodApiToken = token
          this.tencentVodApiTokenIssuedAt = Date.now()
          this.tencentVodApiTokenPromise = null
          return token
        })
        .catch((err: unknown) => {
          this.tencentVodApiTokenPromise = null
          throw err
        })
    }

    return this.tencentVodApiTokenPromise
  }

  private async recoverTencentVodToken(): Promise<void> {
    if (this.tencentVodApiToken && this.tencentVodApiTokenIssuedAt > 0) {
      const age = Date.now() - this.tencentVodApiTokenIssuedAt
      if (age < TENCENT_VOD_TOKEN_WARMUP_MS) {
        await sleep(TENCENT_VOD_TOKEN_WARMUP_MS - age)
        return
      }
    }

    this.tencentVodApiToken = null
    this.tencentVodApiTokenIssuedAt = 0
    this.tencentVodApiTokenPromise = null
    await this.getTencentVodApiToken()
    await sleep(TENCENT_VOD_TOKEN_WARMUP_MS)
  }
}

function safeParseToolArguments(rawArguments: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawArguments)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
