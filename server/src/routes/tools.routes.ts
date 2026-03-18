import type { FastifyInstance } from 'fastify'

export async function toolsRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    tools: [
      { id: 'transcribe', name: 'Transcriber', status: 'available' },
      { id: 'tone', name: 'Tone Generator', status: 'available' },
      { id: 'effects', name: 'Effects Chain', status: 'available' },
      { id: 'recorder', name: 'Quick Recorder', status: 'available' },
    ],
  }))
}
