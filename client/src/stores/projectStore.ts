import { create } from 'zustand'
import type { Project } from '@lava/shared'

// ─── Seed data (demo) ────────────────────────────────────────────────────────

const SEED_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Wonderwall Transcription',
    description: 'Full chord chart for Wonderwall by Oasis',
    space: 'learn',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 3600000,
    metadata: { type: 'transcription' },
  },
  {
    id: 'p2',
    name: 'Blues Practice — 12 Bar in A',
    description: 'Practice progress for 12 Bar Blues',
    space: 'learn',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000,
    metadata: { type: 'practice' },
  },
  {
    id: 'p3',
    name: 'Vintage Blues Crunch Chain',
    description: 'OD → Comp → Spring Reverb',
    space: 'jam',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 7200000,
    metadata: { type: 'effects-chain' },
  },
  {
    id: 'p4',
    name: 'AI Jazz Tone Pack',
    description: 'AI-generated warm jazz tone from Arsenal',
    space: 'jam',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
    metadata: { type: 'gear' },
  },
  {
    id: 'p5',
    name: 'Lo-fi Beat Project',
    description: 'DAW project with 4 tracks',
    space: 'create',
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 1800000,
    metadata: { type: 'daw-project' },
  },
  {
    id: 'p6',
    name: 'Acoustic Demo Export',
    description: 'Exported audio from acoustic session',
    space: 'create',
    createdAt: Date.now() - 86400000 * 6,
    updatedAt: Date.now() - 86400000 * 3,
    metadata: { type: 'export' },
  },
]

// ─── Store ───────────────────────────────────────────────────────────────────

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
  projects: SEED_PROJECTS,
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
