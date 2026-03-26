import { create } from 'zustand'

export interface PracticeSubTask {
  id: string
  title: string
  durationMinutes: number
  completed: boolean
}

export interface PracticeSession {
  id: string
  planId: string
  date: string // "2026-03-27" ISO date
  timeOfDay?: 'morning' | 'afternoon' | 'evening'
  title: string
  totalMinutes: number
  subtasks: PracticeSubTask[]
  completed: boolean
}

export interface PracticePlan {
  id: string
  songTitle: string
  songId?: string
  createdAt: number
  sessions: PracticeSession[]
  goalDescription: string
}

interface CalendarStore {
  plans: PracticePlan[]
  activePlanPreview: PracticePlan | null

  setActivePlanPreview: (plan: PracticePlan) => void
  clearActivePlanPreview: () => void
  addPlan: (plan: PracticePlan) => void
  removePlan: (planId: string) => void
  toggleSessionComplete: (planId: string, sessionId: string) => void
  toggleSubTaskComplete: (planId: string, sessionId: string, subtaskId: string) => void
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  plans: [],
  activePlanPreview: null,

  setActivePlanPreview: (plan) => set({ activePlanPreview: plan }),

  clearActivePlanPreview: () => set({ activePlanPreview: null }),

  addPlan: (plan) => {
    // Dedup by plan.id — replace if exists
    const existing = get().plans.filter((p) => p.id !== plan.id)
    set({ plans: [plan, ...existing], activePlanPreview: null })
  },

  removePlan: (planId) =>
    set((state) => ({ plans: state.plans.filter((p) => p.id !== planId) })),

  toggleSessionComplete: (planId, sessionId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id !== planId
          ? p
          : {
              ...p,
              sessions: p.sessions.map((s) =>
                s.id !== sessionId ? s : { ...s, completed: !s.completed },
              ),
            },
      ),
    })),

  toggleSubTaskComplete: (planId, sessionId, subtaskId) =>
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p
        return {
          ...p,
          sessions: p.sessions.map((s) => {
            if (s.id !== sessionId) return s
            const updatedSubtasks = s.subtasks.map((st) =>
              st.id !== subtaskId ? st : { ...st, completed: !st.completed },
            )
            // Auto-derive session completion
            const allDone = updatedSubtasks.every((st) => st.completed)
            return { ...s, subtasks: updatedSubtasks, completed: allDone }
          }),
        }
      }),
    })),
}))
