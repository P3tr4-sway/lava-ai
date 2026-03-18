import { api } from './api'
import type { Project } from '@lava/shared'
import type { CreateProject, UpdateProject } from '@lava/shared'

export const projectService = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: CreateProject) => api.post<Project>('/projects', data),
  update: (id: string, data: UpdateProject) => api.put<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete<void>(`/projects/${id}`),
}
