import { z } from 'zod'

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
})

export const ChatRequestSchema = z.object({
  messages: z.array(AgentMessageSchema),
  spaceContext: z.object({
    currentSpace: z.enum(['learn', 'jam', 'create', 'tools', 'projects']),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
  }),
})

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  space: z.enum(['learn', 'jam', 'create', 'tools', 'projects']),
  metadata: z.record(z.unknown()).default({}),
})

export const UpdateProjectSchema = CreateProjectSchema.partial()

export const JamSessionSchema = z.object({
  bpm: z.number().min(40).max(240).default(120),
  key: z.string().default('C'),
  scale: z.string().default('major'),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type CreateProject = z.infer<typeof CreateProjectSchema>
export type UpdateProject = z.infer<typeof UpdateProjectSchema>
export type JamSessionConfig = z.infer<typeof JamSessionSchema>
