import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CoachingStyle } from '@lava/shared'

interface CoachState {
  coachingStyle: CoachingStyle
  hasSeenScoreOnboarding: boolean
  currentOnboardingStep: number
  visitedSongIds: string[]
  songSkillAssessments: Record<string, string>
  coachBarCollapsed: boolean

  setCoachingStyle: (style: CoachingStyle) => void
  markOnboardingSeen: () => void
  setOnboardingStep: (step: number) => void
  addVisitedSong: (songId: string) => void
  setSongSkillAssessment: (songId: string, assessment: string) => void
  setCoachBarCollapsed: (collapsed: boolean) => void
  getVisitTier: (songId: string) => 'first' | 'new_song' | 'revisit'
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      coachingStyle: 'passive',
      hasSeenScoreOnboarding: false,
      currentOnboardingStep: 0,
      visitedSongIds: [],
      songSkillAssessments: {},
      coachBarCollapsed: false,

      setCoachingStyle: (style) => set({ coachingStyle: style }),

      markOnboardingSeen: () =>
        set({ hasSeenScoreOnboarding: true, currentOnboardingStep: 0 }),

      setOnboardingStep: (step) => set({ currentOnboardingStep: step }),

      addVisitedSong: (songId) =>
        set((state) => ({
          visitedSongIds: state.visitedSongIds.includes(songId)
            ? state.visitedSongIds
            : [...state.visitedSongIds, songId],
        })),

      setSongSkillAssessment: (songId, assessment) =>
        set((state) => ({
          songSkillAssessments: {
            ...state.songSkillAssessments,
            [songId]: assessment,
          },
        })),

      setCoachBarCollapsed: (collapsed) =>
        set({ coachBarCollapsed: collapsed }),

      getVisitTier: (songId) => {
        const state = get()
        if (!state.hasSeenScoreOnboarding) return 'first'
        if (!state.visitedSongIds.includes(songId)) return 'new_song'
        return 'revisit'
      },
    }),
    { name: 'lava-coach' },
  ),
)
