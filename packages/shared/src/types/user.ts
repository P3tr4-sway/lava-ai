export type PlanTier = 'free' | 'pro' | 'studio'

export interface UserPreferences {
  theme: 'dark' | 'light'
  audioInputDevice?: string
  audioOutputDevice?: string
  defaultBpm: number
  defaultKey: string
}

export interface User {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  plan: PlanTier
  preferences: UserPreferences
  createdAt: number
}
