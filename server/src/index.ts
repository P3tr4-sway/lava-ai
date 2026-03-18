import 'dotenv/config'
import { buildApp } from './app.js'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'

async function start() {
  const app = await buildApp()

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' })
    logger.info(`Server running on http://localhost:${config.port}`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

start()
