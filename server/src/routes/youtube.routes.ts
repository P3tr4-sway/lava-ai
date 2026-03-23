import type { FastifyInstance } from 'fastify'
import { spawn } from 'child_process'
import { mkdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { eq, like, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import { transcriptions, audioFiles } from '../db/schema.js'
import { buildAnalysisScore, type AnalysisScore } from '../utils/chordMapper.js'

const UPLOAD_DIR = './uploads'
const CHORD_MINI_APP_URL = process.env.CHORD_MINI_APP_URL ?? 'http://localhost:5001'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Run a CLI command and collect stdout */
function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args)
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    proc.stdout.on('data', (d) => chunks.push(d))
    proc.stderr.on('data', (d) => errChunks.push(d))

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString('utf-8'))
      } else {
        reject(new Error(Buffer.concat(errChunks).toString('utf-8') || `exit ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

/** Format seconds → "M:SS" */
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Format view count → "1.2M", "340K", etc. */
function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

/** Relative time from upload date */
function fmtUploadDate(dateStr: string): string {
  if (!dateStr) return ''
  // yt-dlp format: YYYYMMDD
  const y = parseInt(dateStr.slice(0, 4), 10)
  const m = parseInt(dateStr.slice(4, 6), 10) - 1
  const d = parseInt(dateStr.slice(6, 8), 10)
  const uploaded = new Date(y, m, d)
  const now = new Date()
  const diffMs = now.getTime() - uploaded.getTime()
  const days = Math.floor(diffMs / 86_400_000)

  if (days < 1) return 'today'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const yrs = Math.floor(days / 365)
  return `${yrs} year${yrs > 1 ? 's' : ''} ago`
}

/** Update transcription status in DB */
async function setStatus(id: string, status: string, extra?: { scoreJson?: string; error?: string }) {
  const updates: Record<string, unknown> = { status }
  if (extra?.scoreJson !== undefined) updates.scoreJson = extra.scoreJson
  if (extra?.error !== undefined) updates.error = extra.error
  if (status === 'completed' || status === 'error') updates.completedAt = Date.now()

  await db.update(transcriptions).set(updates).where(eq(transcriptions.id, id))
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function youtubeRoutes(app: FastifyInstance) {

  // ── Search ──────────────────────────────────────────────────────────────
  app.get<{ Querystring: { q?: string; limit?: string } }>('/search', async (request, reply) => {
    const query = request.query.q?.trim()
    if (!query) return reply.status(400).send({ error: 'q is required' })

    const limit = Math.min(parseInt(request.query.limit ?? '10', 10) || 10, 20)

    try {
      const raw = await run('yt-dlp', [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        `ytsearch${limit}:${query}`,
      ])

      // yt-dlp outputs one JSON object per line
      const results = raw
        .split('\n')
        .filter((line) => line.trim().startsWith('{'))
        .map((line) => {
          const item = JSON.parse(line)
          return {
            id: item.id ?? item.url ?? '',
            title: item.title ?? '',
            channel: item.channel ?? item.uploader ?? '',
            duration: fmtDuration(item.duration ?? 0),
            durationSeconds: item.duration ?? 0,
            views: fmtViews(item.view_count ?? 0),
            viewCount: item.view_count ?? 0,
            thumbnail: item.thumbnails?.length
              ? item.thumbnails[item.thumbnails.length - 1].url
              : `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
            uploadedAt: fmtUploadDate(item.upload_date ?? ''),
          }
        })

      reply.header('Cache-Control', 'private, max-age=300')
      return { results }
    } catch (err) {
      app.log.error(err, 'yt-dlp search failed')
      return reply.status(500).send({ error: 'YouTube search failed' })
    }
  })

  // ── Start analysis (async) ──────────────────────────────────────────────
  app.post<{ Body: { videoId: string; title?: string } }>('/analyze', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const { videoId, title } = request.body ?? {}
    if (!videoId) return reply.status(400).send({ error: 'videoId is required' })

    // Cache hit: return existing completed analysis for the same videoId
    const cached = await db
      .select()
      .from(transcriptions)
      .where(
        and(
          eq(transcriptions.status, 'completed'),
          like(transcriptions.scoreJson, `%"videoId":"${videoId}"%`),
        ),
      )
      .get()

    if (cached) {
      app.log.info(`[pipeline] Cache hit for ${videoId} → transcription ${cached.id}`)
      return { transcriptionId: cached.id }
    }

    const id = uuidv4()
    const now = Date.now()

    // Create transcription record
    await db.insert(transcriptions).values({
      id,
      audioFileId: videoId,
      status: 'downloading',
      createdAt: now,
    })

    // Fire-and-forget the pipeline
    runPipeline(id, videoId, title ?? '', app.log).catch((err) => {
      app.log.error(err, 'Analysis pipeline failed')
    })

    return { transcriptionId: id }
  })

  // ── Poll analysis status ────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/analyze/:id', async (request, reply) => {
    const row = await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.id, request.params.id))
      .get()

    if (!row) return reply.status(404).send({ error: 'Not found' })

    if (row.status === 'completed') {
      reply.header('Cache-Control', 'private, max-age=86400')
    } else {
      reply.header('Cache-Control', 'no-store')
    }

    return {
      id: row.id,
      status: row.status,
      scoreJson: row.scoreJson ? JSON.parse(row.scoreJson) : null,
      error: row.error ?? null,
      audioFileId: row.audioFileId ?? null,
    }
  })
}

// ── Background pipeline ──────────────────────────────────────────────────────

async function runPipeline(
  transcriptionId: string,
  videoId: string,
  title: string,
  log: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void },
) {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })

    // 1. Download audio (skip if already cached on disk)
    const mp3Path = join(UPLOAD_DIR, `yt-${videoId}.mp3`)
    let fileStat: import('fs').Stats | null = null
    try {
      fileStat = await stat(mp3Path)
      log.info(`[pipeline] Audio cache hit for ${videoId} — skipping download`)
    } catch {
      log.info(`[pipeline] Downloading audio for ${videoId}`)
      const outTemplate = join(UPLOAD_DIR, `yt-${videoId}.%(ext)s`)
      await run('yt-dlp', [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '-o', outTemplate,
        '--no-playlist',
        '--no-warnings',
        `https://www.youtube.com/watch?v=${videoId}`,
      ])
      fileStat = await stat(mp3Path)
    }

    // Store audio file record
    const audioId = uuidv4()
    await db.insert(audioFiles).values({
      id: audioId,
      name: title || `yt-${videoId}.mp3`,
      format: 'mp3',
      size: fileStat!.size,
      filePath: mp3Path,
      createdAt: Date.now(),
    })

    // Update transcription with real audio file reference
    await db.update(transcriptions)
      .set({ audioFileId: audioId })
      .where(eq(transcriptions.id, transcriptionId))

    // 2. Recognize chords
    await setStatus(transcriptionId, 'analyzing_chords')
    log.info(`[pipeline] Analyzing chords for ${videoId}`)

    const chordResult = await postAudioToChordMiniApp(mp3Path, '/api/recognize-chords')

    // 3. Detect beats
    await setStatus(transcriptionId, 'analyzing_beats')
    log.info(`[pipeline] Detecting beats for ${videoId}`)

    const beatResult = await postAudioToChordMiniApp(mp3Path, '/api/detect-beats')

    // 4. Build score
    await setStatus(transcriptionId, 'processing')
    log.info(`[pipeline] Building score for ${videoId}`)

    const chords = (chordResult.chords ?? []) as import('../utils/chordMapper.js').ChordMiniAppChord[]
    const duration = (chordResult.duration ?? 0) as number

    // Debug: log what ChordMiniApp actually returned
    log.info(`[pipeline] Chord result keys: ${Object.keys(chordResult).join(', ')}`)
    log.info(`[pipeline] Chords count: ${chords.length}, duration: ${duration}`)
    if (chords.length > 0) log.info(`[pipeline] First chord: ${JSON.stringify(chords[0])}`)
    log.info(`[pipeline] Beat result keys: ${Object.keys(beatResult).join(', ')}`)
    log.info(`[pipeline] Beats count: ${(beatResult.beats as number[] | undefined)?.length ?? 0}, bpm: ${beatResult.bpm}`)

    const score: AnalysisScore = buildAnalysisScore(
      { chords, duration },
      {
        bpm: (beatResult.bpm ?? 120) as number,
        beats: (beatResult.beats ?? []) as number[],
        downbeats: (beatResult.downbeats ?? []) as number[],
        time_signature: (beatResult.time_signature ?? 4) as number,
      },
    )

    log.info(`[pipeline] Score sections: ${score.sections.length}, total measures: ${score.sections.reduce((a, s) => a + s.measures.length, 0)}`)

    // Add title to score
    const scoreWithTitle = { ...score, title: title || videoId, videoId }

    await setStatus(transcriptionId, 'completed', {
      scoreJson: JSON.stringify(scoreWithTitle),
    })

    log.info(`[pipeline] Analysis complete for ${videoId}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error(`[pipeline] Error: ${msg}`)
    await setStatus(transcriptionId, 'error', { error: msg })
  }
}

/** POST an audio file to ChordMiniApp endpoint using multipart/form-data */
async function postAudioToChordMiniApp(filePath: string, endpoint: string): Promise<Record<string, unknown>> {
  const fileBuffer = await readFile(filePath)

  // Build multipart form data manually
  const boundary = `----FormBoundary${Date.now()}`
  const filename = filePath.split('/').pop() ?? 'audio.mp3'

  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: audio/mpeg\r\n\r\n`,
  )
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([header, fileBuffer, footer])

  const url = `${CHORD_MINI_APP_URL}${endpoint}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ChordMiniApp ${endpoint} failed (${response.status}): ${text}`)
  }

  return response.json() as Promise<Record<string, unknown>>
}
