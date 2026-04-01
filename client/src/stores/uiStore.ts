import { create } from 'zustand'

type Theme = 'system' | 'light' | 'dark'

function readTheme(): Theme {
  try {
    const v = localStorage.getItem('lava-theme')
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'light'
}

function readSidebarCollapsed(): boolean {
  try {
    const v = localStorage.getItem('lava-sidebar-collapsed')
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {}
  return true // default: icon-only collapsed
}

interface UIStore {
  sidebarCollapsed: boolean
  sidebarOpen: boolean
  activeModal: string | null
  theme: Theme
  authPromptOpen: boolean
  authPromptAction: string | null

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
  setTheme: (theme: Theme) => void
  openAuthPrompt: (action?: string) => void
  closeAuthPrompt: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: readSidebarCollapsed(),
  sidebarOpen: false,
  activeModal: null,
  theme: readTheme(),

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed
      try { localStorage.setItem('lava-sidebar-collapsed', String(next)) } catch {}
      return { sidebarCollapsed: next }
    }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
  setTheme: (theme) => {
    try { localStorage.setItem('lava-theme', theme) } catch {}
    set({ theme })
  },

  authPromptOpen: false,
  authPromptAction: null,
  openAuthPrompt: (action) => set({ authPromptOpen: true, authPromptAction: action ?? null }),
  closeAuthPrompt: () => set({ authPromptOpen: false, authPromptAction: null }),
}))
