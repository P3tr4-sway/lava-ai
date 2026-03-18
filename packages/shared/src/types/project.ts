import type { SpaceType } from './agent.js'

export interface Project {
  id: string
  name: string
  description?: string
  space: SpaceType
  createdAt: number
  updatedAt: number
  metadata: Record<string, unknown>
}

export interface ProjectVersion {
  id: string
  projectId: string
  version: number
  snapshot: Record<string, unknown>
  createdAt: number
}
