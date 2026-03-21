import type { FastifyInstance } from 'fastify'
import { createHash } from 'crypto'
import { db } from '../db/client.js'
import { projects } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { CreateProjectSchema, UpdateProjectSchema } from '@lava/shared'

export async function projectRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const results = await db.select().from(projects).orderBy(projects.updatedAt)

    const maxUpdatedAt = results.reduce((max, p) => Math.max(max, p.updatedAt), 0)
    const etag = `"${createHash('md5').update(JSON.stringify(maxUpdatedAt)).digest('hex')}"`

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send()
    }

    reply.header('Cache-Control', 'private, no-cache')
    reply.header('ETag', etag)
    return results
  })

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const project = await db.select().from(projects).where(eq(projects.id, request.params.id)).get()
    if (!project) return reply.status(404).send({ error: 'Not found' })

    const etag = `"${createHash('md5').update(JSON.stringify(project.updatedAt)).digest('hex')}"`

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send()
    }

    reply.header('Cache-Control', 'private, no-cache')
    reply.header('ETag', etag)
    return project
  })

  app.post('/', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const parsed = CreateProjectSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const now = Date.now()
    const id = uuidv4()
    const data = parsed.data

    await db.insert(projects).values({
      id,
      name: data.name,
      description: data.description ?? null,
      space: data.space,
      metadata: JSON.stringify(data.metadata),
      createdAt: now,
      updatedAt: now,
    })

    return await db.select().from(projects).where(eq(projects.id, id)).get()
  })

  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const parsed = UpdateProjectSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const existing = await db.select().from(projects).where(eq(projects.id, request.params.id)).get()
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const u = parsed.data
    await db
      .update(projects)
      .set({
        ...(u.name !== undefined && { name: u.name }),
        ...(u.description !== undefined && { description: u.description }),
        ...(u.space !== undefined && { space: u.space }),
        ...(u.metadata !== undefined && { metadata: JSON.stringify(u.metadata) }),
        updatedAt: Date.now(),
      })
      .where(eq(projects.id, request.params.id))

    return await db.select().from(projects).where(eq(projects.id, request.params.id)).get()
  })

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    await db.delete(projects).where(eq(projects.id, request.params.id))
    return reply.status(204).send()
  })
}
