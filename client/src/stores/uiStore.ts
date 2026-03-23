import { create } from 'zustand'

type Theme = 'system' | 'light' | 'dark'

function readTheme(): Theme {
  try {
    const v = localStorage.getItem('lava-theme')
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

function readSidebarCollapsed(): boolean {
  try {
    const v = localStorage.getItem('lava-sidebar-collapsed')
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {}
  return false
}

interface UIStore {
  agentPanelOpen: boolean
  sidebarCollapsed: boolean
  sidebarOpen: boolean
  activeModal: string | null
  theme: Theme
  authPromptOpen: boolean
  authPromptAction: string | null

  toggleAgentPanel: () => void
  setAgentPanelOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
  setTheme: (theme: Theme) => void
  openAuthPrompt: (action?: string) => void
  closeAuthPrompt: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  agentPanelOpen: false,
  sidebarCollapsed: readSidebarCollapsed(),
  sidebarOpen: false,
  activeModal: null,
  theme: readTheme(),

  toggleAgentPanel: () => set((state) => ({ agentPanelOpen: !state.agentPanelOpen })),
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
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
