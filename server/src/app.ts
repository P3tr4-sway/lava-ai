import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { config } from './config/index.js'
import { agentRoutes } from './routes/agent.routes.js'
import { projectRoutes } from './routes/project.routes.js'
import { audioRoutes } from './routes/audio.routes.js'
import { transcriptionRoutes } from './routes/transcription.routes.js'
import { jamRoutes } from './routes/jam.routes.js'
import { toolsRoutes } from './routes/tools.routes.js'
import { pdfRoutes } from './routes/pdf.routes.js'
import { youtubeRoutes } from './routes/youtube.routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'warn' : 'info',
    },
  })

  // Plugins
  await app.register(cors, {
    origin: config.clientOrigin,
    credentials: true,
  })

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  })

  // Routes
  await app.register(agentRoutes, { prefix: '/api/agent' })
  await app.register(projectRoutes, { prefix: '/api/projects' })
  await app.register(audioRoutes, { prefix: '/api/audio' })
  await app.register(transcriptionRoutes, { prefix: '/api/transcribe' })
  await app.register(jamRoutes, { prefix: '/api/jam' })
  await app.register(toolsRoutes, { prefix: '/api/tools' })
  await app.register(pdfRoutes, { prefix: '/api/pdf' })
  await app.register(youtubeRoutes, { prefix: '/api/youtube' })

  app.get('/api/health', async () => ({ status: 'ok', ts: Date.now() }))

  return app
}
