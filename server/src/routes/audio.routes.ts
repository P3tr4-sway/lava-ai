import type { FastifyInstance } from 'fastify'
import { writeFile, mkdir, access } from 'fs/promises'
import { createReadStream } from 'fs'
import { join, extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { audioFiles } from '../db/schema.js'

const UPLOAD_DIR = './uploads'

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
}

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

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params

    // 1. Look up the record in the database
    const rows = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, id))
      .limit(1)

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Audio file not found' })
    }

    const record = rows[0]

    // 2. Verify the file exists on disk
    try {
      await access(record.filePath)
    } catch {
      return reply.status(404).send({ error: 'Audio file not found on disk' })
    }

    // 3. Determine Content-Type from the stored format
    const mimeType = MIME_TYPES[record.format.toLowerCase()] ?? 'application/octet-stream'
    reply.header('Content-Type', mimeType)

    // 4. Stream the file to the client
    const stream = createReadStream(record.filePath)

    stream.on('error', (err) => {
      app.log.error(err, 'Error streaming audio file')
      if (!reply.sent) {
        reply.status(500).send({ error: 'Failed to read audio file' })
      }
    })

    return reply.send(stream)
  })
}
