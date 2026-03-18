import { ToolRegistry } from './ToolRegistry.js'
import { ToolExecutor } from './ToolExecutor.js'
import { ALL_TOOLS } from './definitions/index.js'
import { db } from '../../db/client.js'
import { projects } from '../../db/schema.js'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'

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
  }

  return handlers[name] ?? (async () => ({ error: `No handler for tool: ${name}` }))
}

export { ToolRegistry, ToolExecutor }
