import { create } from 'zustand'
import type { Project } from '@lava/shared'

interface ProjectStore {
  projects: Project[]
  activeProject: Project | null
  isDirty: boolean

  setProjects: (projects: Project[]) => void
  setActiveProject: (project: Project | null) => void
  upsertProject: (project: Project) => void
  removeProject: (id: string) => void
  setDirty: (dirty: boolean) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  activeProject: null,
  isDirty: false,

  setProjects: (projects) => set({ projects }),

  setActiveProject: (project) => set({ activeProject: project, isDirty: false }),

  upsertProject: (project) =>
    set((state) => {
      const idx = state.projects.findIndex((p) => p.id === project.id)
      if (idx >= 0) {
        const projects = [...state.projects]
        projects[idx] = project
        return { projects }
      }
      return { projects: [...state.projects, project] }
    }),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProject: state.activeProject?.id === id ? null : state.activeProject,
    })),

  setDirty: (dirty) => set({ isDirty: dirty }),
}))
