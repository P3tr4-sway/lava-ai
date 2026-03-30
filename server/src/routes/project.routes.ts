import type { FastifyInstance } from 'fastify'
import { createHash } from 'crypto'
import { db } from '../db/client.js'
import { projects, projectVersions } from '../db/schema.js'
import { desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { CreateProjectSchema, UpdateProjectSchema } from '@lava/shared'
import { z } from 'zod'

function parseProject(row: { id: string; name: string; description: string | null; space: string; metadata: string; createdAt: number; updatedAt: number }) {
  return {
    ...row,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  }
}

function parseProjectVersion(row: { id: string; projectId: string; version: number; snapshot: string; createdAt: number }) {
  return {
    ...row,
    snapshot: JSON.parse(row.snapshot) as Record<string, unknown>,
  }
}

const CreateProjectVersionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.enum(['arrangement', 'ai-transform']),
  arrangementId: z.string().optional(),
  musicXml: z.string(),
  scoreSnapshot: z.record(z.unknown()).optional(),
  parentVersionId: z.string().optional(),
  createdAt: z.number().int().optional(),
  prompt: z.string().optional(),
  changeSummary: z.array(z.string()).optional(),
})

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
    return results.map(parseProject)
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
    return parseProject(project)
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

    const created = await db.select().from(projects).where(eq(projects.id, id)).get()
    return created ? parseProject(created) : created
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

    const updated = await db.select().from(projects).where(eq(projects.id, request.params.id)).get()
    return updated ? parseProject(updated) : updated
  })

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    await db.delete(projects).where(eq(projects.id, request.params.id))
    return reply.status(204).send()
  })

  app.get<{ Params: { id: string } }>('/:id/versions', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')

    const existing = await db.select().from(projects).where(eq(projects.id, request.params.id)).get()
    if (!existing) return reply.status(404).send({ error: 'Project not found' })

    const results = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, request.params.id))
      .orderBy(projectVersions.version)

    return results.map(parseProjectVersion)
  })

  app.post<{ Params: { id: string } }>('/:id/versions', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')

    const existing = await db.select().from(projects).where(eq(projects.id, request.params.id)).get()
    if (!existing) return reply.status(404).send({ error: 'Project not found' })

    const parsed = CreateProjectVersionSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const latest = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, request.params.id))
      .orderBy(desc(projectVersions.version))
      .get()

    const nextVersionNumber = (latest?.version ?? 0) + 1
    const payload = parsed.data
    const createdAt = payload.createdAt ?? Date.now()

    await db.insert(projectVersions).values({
      id: payload.id,
      projectId: request.params.id,
      version: nextVersionNumber,
      snapshot: JSON.stringify({
        ...payload,
        createdAt,
      }),
      createdAt,
    })

    const created = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, payload.id))
      .get()

    return created ? parseProjectVersion(created) : created
  })
}
