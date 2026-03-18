import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/client.js'
import { transcriptions } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export async function transcriptionRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = request.body as { audioFileId?: string }
    if (!body.audioFileId) return reply.status(400).send({ error: 'audioFileId required' })

    const id = uuidv4()
    const now = Date.now()

    await db.insert(transcriptions).values({
      id,
      audioFileId: body.audioFileId,
      status: 'pending',
      createdAt: now,
    })

    return { id, audioFileId: body.audioFileId, status: 'pending', createdAt: now }
  })

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.id, request.params.id))
      .get()
    if (!result) return reply.status(404).send({ error: 'Not found' })
    return result
  })
}
