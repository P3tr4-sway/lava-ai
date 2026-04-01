import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dotenv from 'dotenv'

// Must run before any other local imports so that parseEnv() in config/index.ts
// reads the populated process.env. Static imports are hoisted in ESM, so we
// use dynamic imports for everything that depends on env vars.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const { buildApp } = await import('./app.js')
const { config } = await import('./config/index.js')
const { logger } = await import('./utils/logger.js')

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
