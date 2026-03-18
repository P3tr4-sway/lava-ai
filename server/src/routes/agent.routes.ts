import type { FastifyInstance } from 'fastify'
import { AgentOrchestrator } from '../agent/AgentOrchestrator.js'
import { ChatRequestSchema } from '@lava/shared'
import type { AgentMessage, StreamEvent } from '@lava/shared'

export async function agentRoutes(app: FastifyInstance) {
  const orchestrator = new AgentOrchestrator()

  app.post('/chat', async (request, reply) => {
    const parsed = ChatRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() })
    }

    const messages = parsed.data.messages as AgentMessage[]
    const { spaceContext } = parsed.data

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const send = (event: StreamEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    try {
      await orchestrator.run(messages, spaceContext, send)
    } catch (err) {
      send({ type: 'error', error: String(err) })
    } finally {
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
    }
  })
}
