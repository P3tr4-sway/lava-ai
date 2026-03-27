import { ToolRegistry } from './ToolRegistry.js'
import { ToolExecutor } from './ToolExecutor.js'
import { ALL_TOOLS } from './definitions/index.js'
import { db } from '../../db/client.js'
import { projects } from '../../db/schema.js'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry()

  for (const tool of ALL_TOOLS) {
    registry.register(tool, getHandler(tool.name))
  }

  return registry
}

function getHandler(name: string) {
  const handlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
    navigate_to_space: async (input) => ({
      action: 'navigate',
      space: input.space,
      reason: input.reason,
    }),

    open_search_results: async (input) => {
      const songTitle = String(input.songTitle ?? '').trim()
      const artist = String(input.artist ?? '').trim()
      const selectionReason = String(input.selectionReason ?? '').trim()
      const fallbackQuery = String(input.query ?? '').trim()
      const query = songTitle
        ? [songTitle, artist].filter(Boolean).join(' ')
        : fallbackQuery

      return {
        action: 'open_search_results',
        query,
        songTitle: songTitle || undefined,
        artist: artist || undefined,
        selectionReason: selectionReason || undefined,
      }
    },

    create_project: async (input) => {
      const now = Date.now()
      const id = uuidv4()
      await db.insert(projects).values({
        id,
        name: String(input.name),
        description: input.description ? String(input.description) : null,
        space: String(input.space),
        metadata: '{}',
        createdAt: now,
        updatedAt: now,
      })
      return { id, name: input.name, space: input.space, createdAt: now }
    },

    list_projects: async (input) => {
      const query = input.space
        ? db.select().from(projects).where(eq(projects.space, String(input.space)))
        : db.select().from(projects)
      return await query
    },

    load_project: async (input) => {
      const result = await db
        .select()
        .from(projects)
        .where(eq(projects.id, String(input.projectId)))
        .get()
      return result ?? { error: 'Project not found' }
    },

    start_jam: async (input) => ({
      action: 'start_jam',
      bpm: input.bpm ?? 120,
      key: input.key ?? 'C',
      scale: input.scale ?? 'major',
    }),

    set_tempo: async (input) => ({ action: 'set_tempo', bpm: input.bpm }),

    set_key: async (input) => ({ action: 'set_key', key: input.key }),

    start_transcription: async (input) => ({
      transcriptionId: uuidv4(),
      audioFileId: input.audioFileId,
      status: 'queued',
      message: 'Transcription started',
    }),

    get_transcription_status: async (input) => ({
      transcriptionId: input.transcriptionId,
      status: 'processing',
      progress: 42,
    }),

    add_track: async (input) => ({
      trackId: uuidv4(),
      name: input.name,
      type: input.type,
      action: 'add_track',
    }),

    ai_compose: async (input) => ({
      compositionId: uuidv4(),
      prompt: input.prompt,
      status: 'generating',
      message: 'AI composition started',
    }),

    upload_audio: async (input) => ({
      audioFileId: input.audioFileId,
      status: 'ready',
    }),

    process_audio: async (input) => ({
      audioFileId: input.audioFileId,
      operation: input.operation,
      status: 'processing',
    }),

    coach_message: async (input) => {
      const { content, subtype, targetId, chipsJson } = input as {
        content: string
        subtype: string
        targetId?: string
        chipsJson?: string
      }

      const chipSchema = z.array(z.object({
        label: z.string(),
        value: z.string(),
        action: z.enum(['advance', 'expand', 'set_style', 'create_plan', 'navigate']).optional(),
      }))

      let chips = undefined
      if (chipsJson) {
        const parsed = JSON.parse(String(chipsJson))
        chips = chipSchema.parse(parsed)
      }

      return {
        action: 'coach_message',
        content,
        subtype,
        targetId,
        chips,
      }
    },

    create_practice_plan: async (input) => {
      const songTitle = String(input.songTitle)
      const goalDescription = String(input.goalDescription ?? `Practice ${songTitle}`)
      // Note: durationDays, minutesPerDay, skillLevel, focusAreas are LLM-guidance
      // parameters — they inform how the LLM generates sessionsJson but are not
      // consumed by this handler directly.
      const planId = uuidv4()
      const now = Date.now()

      // Parse and validate sessionsJson with Zod
      const sessionSchema = z.array(z.object({
        title: z.string(),
        totalMinutes: z.number(),
        timeOfDay: z.enum(['morning', 'afternoon', 'evening']).optional(),
        subtasks: z.array(z.object({
          title: z.string(),
          durationMinutes: z.number(),
        })).default([]),
      }))

      let rawSessions: z.infer<typeof sessionSchema>
      try {
        const parsed = JSON.parse(String(input.sessionsJson))
        rawSessions = sessionSchema.parse(parsed)
      } catch (err) {
        const msg = err instanceof z.ZodError
          ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
          : 'Invalid sessionsJson — must be a JSON array of session objects'
        return { error: msg }
      }

      // Build sessions with IDs and dates starting from today
      // Use local date formatting to avoid UTC timezone mismatch
      const today = new Date()
      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const sessions = rawSessions.map((raw, i) => {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateStr = toDateStr(date)

        return {
          id: uuidv4(),
          planId,
          date: dateStr,
          timeOfDay: raw.timeOfDay,
          title: raw.title,
          totalMinutes: raw.totalMinutes,
          completed: false,
          subtasks: (raw.subtasks ?? []).map((st) => ({
            id: uuidv4(),
            title: st.title,
            durationMinutes: st.durationMinutes,
            completed: false,
          })),
        }
      })

      return {
        action: 'practice_plan',
        plan: {
          id: planId,
          songTitle,
          songId: input.songId ? String(input.songId) : undefined,
          createdAt: now,
          goalDescription,
          sessions,
        },
      }
    },
  }

  return handlers[name] ?? (async () => ({ error: `No handler for tool: ${name}` }))
}

export { ToolRegistry, ToolExecutor }
