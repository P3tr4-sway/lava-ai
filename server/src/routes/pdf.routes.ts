import type { FastifyInstance } from 'fastify'
import { writeFile, mkdir, access } from 'fs/promises'
import { createReadStream } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

const PDF_UPLOAD_DIR = './uploads/pdfs'

export async function pdfRoutes(app: FastifyInstance) {
  app.post('/upload', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file provided' })

    await mkdir(PDF_UPLOAD_DIR, { recursive: true })

    const id = uuidv4()
    const filePath = join(PDF_UPLOAD_DIR, `${id}.pdf`)
    const buffer = await data.toBuffer()
    await writeFile(filePath, buffer)

    return { url: `/api/pdf/${id}` }
  })

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params
    const filePath = join(PDF_UPLOAD_DIR, `${id}.pdf`)

    try {
      await access(filePath)
    } catch {
      return reply.status(404).send({ error: 'PDF not found' })
    }

    reply.header('Content-Type', 'application/pdf')
    const stream = createReadStream(filePath)
    stream.on('error', (err) => {
      app.log.error(err, 'Error streaming PDF')
      if (!reply.sent) reply.status(500).send({ error: 'Failed to read PDF' })
    })
    return reply.send(stream)
  })
}
