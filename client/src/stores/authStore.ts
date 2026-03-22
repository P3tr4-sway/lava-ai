import { create } from 'zustand'
import type { User } from '@lava/shared'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  hasCompletedOnboarding: boolean

  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  loginWithProvider: (provider: 'google' | 'apple' | 'lava') => Promise<void>
  logout: () => void
  completeOnboarding: () => void
}

function readPersistedAuth(): { user: User | null; isAuthenticated: boolean } {
  try {
    const raw = localStorage.getItem('lava-auth')
    if (raw) {
      const parsed = JSON.parse(raw) as User
      if (parsed && parsed.id) {
        return { user: parsed, isAuthenticated: true }
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { user: null, isAuthenticated: false }
}

function readOnboardingComplete(): boolean {
  try {
    return localStorage.getItem('lava-onboarding-complete') === 'true'
  } catch {
    return false
  }
}

function persistAuth(user: User | null) {
  try {
    if (user) {
      localStorage.setItem('lava-auth', JSON.stringify(user))
    } else {
      localStorage.removeItem('lava-auth')
    }
  } catch {
    // storage unavailable
  }
}

function persistOnboarding(complete: boolean) {
  try {
    localStorage.setItem('lava-onboarding-complete', String(complete))
  } catch {
    // storage unavailable
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createMockUser(name: string, email: string): User {
  return {
    id: 'user_1',
    name,
    email,
    plan: 'free',
    preferences: {
      theme: 'dark',
      defaultBpm: 120,
      defaultKey: 'C',
    },
    createdAt: Date.now(),
  }
}

const persisted = readPersistedAuth()

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: persisted.isAuthenticated,
  user: persisted.user,
  isLoading: false,
  hasCompletedOnboarding: readOnboardingComplete(),

  login: async (email: string, _password: string) => {
    set({ isLoading: true })
    await delay(500)
    const user = createMockUser(email.split('@')[0], email)
    persistAuth(user)
    set({
      isAuthenticated: true,
      user,
      isLoading: false,
      hasCompletedOnboarding: readOnboardingComplete(),
    })
  },

  signup: async (name: string, email: string, _password: string) => {
    set({ isLoading: true })
    await delay(500)
    const user = createMockUser(name, email)
    persistAuth(user)
    persistOnboarding(false)
    set({
      isAuthenticated: true,
      user,
      isLoading: false,
      hasCompletedOnboarding: false,
    })
  },

  loginWithProvider: async (provider: 'google' | 'apple' | 'lava') => {
    set({ isLoading: true })
    await delay(500)
    const providerNames: Record<string, string> = {
      google: 'Google User',
      apple: 'Apple User',
      lava: 'LAVA User',
    }
    const user = createMockUser(
      providerNames[provider],
      `${provider}@example.com`,
    )
    persistAuth(user)
    set({
      isAuthenticated: true,
      user,
      isLoading: false,
      hasCompletedOnboarding: readOnboardingComplete(),
    })
  },

  logout: () => {
    persistAuth(null)
    set({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    })
  },

  completeOnboarding: () => {
    persistOnboarding(true)
    set({ hasCompletedOnboarding: true })
  },
}))
