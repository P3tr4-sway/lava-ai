import { api } from './api'
import { localProjectStore } from './localProjectStore'
import type { Project, ProjectVersion, Version } from '@lava/shared'
import type { CreateProject, UpdateProject } from '@lava/shared'

export interface CreateVersionPayload extends Version {
  changeSummary?: string[]
}

// On Vercel the client is deployed without the Fastify backend, so every
// `/api/*` request resolves to `index.html` (catch-all SPA rewrite). That
// makes `res.json()` throw. The first such failure flips `useLocal` and all
// subsequent calls route through localStorage for the rest of the session.
let useLocal = false

async function withFallback<T>(
  remote: () => Promise<T>,
  local: () => T | null,
  onMissing?: () => T,
): Promise<T> {
  if (useLocal) {
    const cached = local()
    if (cached !== null) return cached
    if (onMissing) return onMissing()
    throw new Error('Project not found in local store')
  }
  try {
    return await remote()
  } catch (err) {
    console.warn('[projectService] API unavailable, falling back to local store', err)
    useLocal = true
    const cached = local()
    if (cached !== null) return cached
    if (onMissing) return onMissing()
    throw err
  }
}

export const projectService = {
  list: () =>
    withFallback<Project[]>(
      () => api.get<Project[]>('/projects'),
      () => localProjectStore.list(),
    ),

  get: (id: string) =>
    withFallback<Project>(
      () => api.get<Project>(`/projects/${id}`),
      () => localProjectStore.get(id),
    ),

  create: (data: CreateProject) =>
    withFallback<Project>(
      () => api.post<Project>('/projects', data),
      () => localProjectStore.create(data),
    ),

  update: (id: string, data: UpdateProject) =>
    withFallback<Project>(
      () => api.put<Project>(`/projects/${id}`, data),
      () => localProjectStore.update(id, data),
      // If the project doesn't exist yet locally (e.g. user skipped create
      // and navigated directly), fall back to creating it so saves aren't lost.
      () => {
        const created = localProjectStore.create({
          name: data.name ?? 'Untitled Project',
          description: data.description,
          space: data.space ?? 'create',
          metadata: data.metadata ?? {},
        })
        return created
      },
    ),

  delete: (id: string) =>
    withFallback<void>(
      () => api.delete<void>(`/projects/${id}`),
      () => {
        localProjectStore.delete(id)
        return undefined as void
      },
    ),

  listVersions: (projectId: string) =>
    withFallback<ProjectVersion[]>(
      () => api.get<ProjectVersion[]>(`/projects/${projectId}/versions`),
      () => localProjectStore.listVersions(projectId),
    ),

  createVersion: (projectId: string, data: CreateVersionPayload) =>
    withFallback<ProjectVersion>(
      () => api.post<ProjectVersion>(`/projects/${projectId}/versions`, data),
      () => localProjectStore.createVersion(projectId, data),
    ),
}
