// client/src/stores/taskStore.ts
import { create } from 'zustand'
import type { AnalysisStatus, AnalysisPollResult } from '@/services/youtubeService'

export interface BackgroundTask {
  id: string               // transcriptionId (server-assigned)
  videoId: string          // original YouTube video ID (needed for retry)
  type: 'analysis'
  title: string
  status: 'active' | 'completed' | 'error'
  stage: AnalysisStatus
  progress: number         // 0-100, derived from stage
  createdAt: number
  completedAt?: number
  result?: AnalysisPollResult
  error?: string
}

export const STAGE_PROGRESS: Record<AnalysisStatus, number> = {
  downloading: 10,
  analyzing_chords: 35,
  analyzing_beats: 65,
  processing: 85,
  completed: 100,
  error: 0,
}

export const STAGE_LABEL: Record<AnalysisStatus, string> = {
  downloading: 'Downloading audio...',
  analyzing_chords: 'Detecting chords...',
  analyzing_beats: 'Analyzing beats & tempo...',
  processing: 'Building score...',
  completed: 'Done',
  error: 'Error',
}

interface TaskStore {
  tasks: BackgroundTask[]
  // addTask: transcriptionId, YouTube videoId, display title
  addTask: (id: string, videoId: string, title: string) => void
  updateTask: (id: string, updates: Partial<Omit<BackgroundTask, 'id' | 'videoId' | 'createdAt'>>) => void
  removeTask: (id: string) => void
  getTask: (id: string) => BackgroundTask | undefined
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],

  addTask: (id, videoId, title) => {
    // Dedup: if task already exists (any status), don't add again
    if (get().tasks.find((t) => t.id === id)) return
    const task: BackgroundTask = {
      id,
      videoId,
      type: 'analysis',
      title,
      status: 'active',
      stage: 'downloading',
      progress: STAGE_PROGRESS.downloading,
      createdAt: Date.now(),
    }
    set((state) => ({ tasks: [task, ...state.tasks] }))
  },

  updateTask: (id, updates: Partial<Omit<BackgroundTask, 'id' | 'videoId' | 'createdAt'>>) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  getTask: (id) => get().tasks.find((t) => t.id === id),
}))
