import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const devPorts = [3001, 5173]

function listListeningPids(port) {
  try {
    const output = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    return output
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value))
  } catch {
    return []
  }
}

function getCommand(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function isRepoDevProcess(command) {
  if (!command.includes(repoRoot)) {
    return false
  }

  return (
    command.includes('/vite/bin/vite.js') ||
    command.includes('tsx') ||
    command.includes('src/index.ts')
  )
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!isAlive(pid)) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return !isAlive(pid)
}

async function stopRepoDevProcesses() {
  const seen = new Set()

  for (const port of devPorts) {
    for (const pid of listListeningPids(port)) {
      if (seen.has(pid)) {
        continue
      }

      seen.add(pid)
      const command = getCommand(pid)

      if (!isRepoDevProcess(command)) {
        console.log(`Skipping port ${port} owner ${pid} because it is not a Lava dev process.`)
        continue
      }

      console.log(`Stopping stale dev process ${pid} on port ${port}.`)
      process.kill(pid, 'SIGTERM')

      const exited = await waitForExit(pid, 2000)
      if (!exited) {
        console.log(`Force stopping dev process ${pid}.`)
        process.kill(pid, 'SIGKILL')
        await waitForExit(pid, 1000)
      }
    }
  }
}

async function main() {
  await stopRepoDevProcesses()

  const child = spawn('pnpm', ['--parallel', '-r', 'dev'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.on('SIGINT', forwardSignal)
  process.on('SIGTERM', forwardSignal)

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
