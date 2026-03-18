import type { FastifyInstance } from 'fastify'
import { JamSessionSchema } from '@lava/shared'
import { v4 as uuidv4 } from 'uuid'

export async function jamRoutes(app: FastifyInstance) {
  app.post('/session', async (request, reply) => {
    const parsed = JamSessionSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const { bpm, key, scale } = parsed.data

    return {
      id: uuidv4(),
      bpm,
      key,
      scale,
      activeLoops: [],
      startedAt: Date.now(),
    }
  })
}
