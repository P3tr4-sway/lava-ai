import { api } from './api'
import type { Project, ProjectVersion, Version } from '@lava/shared'
import type { CreateProject, UpdateProject } from '@lava/shared'

export interface CreateVersionPayload extends Version {
  changeSummary?: string[]
}

export const projectService = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: CreateProject) => api.post<Project>('/projects', data),
  update: (id: string, data: UpdateProject) => api.put<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete<void>(`/projects/${id}`),
  listVersions: (projectId: string) => api.get<ProjectVersion[]>(`/projects/${projectId}/versions`),
  createVersion: (projectId: string, data: CreateVersionPayload) =>
    api.post<ProjectVersion>(`/projects/${projectId}/versions`, data),
}
