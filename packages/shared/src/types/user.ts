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
  preferences: UserPreferences
  createdAt: number
}
