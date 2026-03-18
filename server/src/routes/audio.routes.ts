import type { FastifyInstance } from 'fastify'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/client.js'
import { audioFiles } from '../db/schema.js'

const UPLOAD_DIR = './uploads'

export async function audioRoutes(app: FastifyInstance) {
  app.post('/upload', async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file provided' })

    await mkdir(UPLOAD_DIR, { recursive: true })

    const id = uuidv4()
    const ext = extname(data.filename) || '.bin'
    const fileName = `${id}${ext}`
    const filePath = join(UPLOAD_DIR, fileName)

    const buffer = await data.toBuffer()
    await writeFile(filePath, buffer)

    const now = Date.now()
    await db.insert(audioFiles).values({
      id,
      name: data.filename,
      format: ext.replace('.', ''),
      size: buffer.length,
      filePath,
      createdAt: now,
    })

    return {
      id,
      name: data.filename,
      format: ext.replace('.', ''),
      size: buffer.length,
      url: `/api/audio/${id}`,
      duration: 0,
      sampleRate: 44100,
      channels: 2,
      createdAt: now,
    }
  })
}
