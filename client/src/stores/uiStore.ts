import { create } from 'zustand'

type Theme = 'system' | 'light' | 'dark'

function readTheme(): Theme {
  try {
    const v = localStorage.getItem('lava-theme')
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

interface UIStore {
  agentPanelOpen: boolean
  sidebarCollapsed: boolean
  activeModal: string | null
  theme: Theme

  toggleAgentPanel: () => void
  setAgentPanelOpen: (open: boolean) => void
  toggleSidebar: () => void
  openModal: (id: string) => void
  closeModal: () => void
  setTheme: (theme: Theme) => void
}

export const useUIStore = create<UIStore>((set) => ({
  agentPanelOpen: false,
  sidebarCollapsed: false,
  activeModal: null,
  theme: readTheme(),

  toggleAgentPanel: () => set((state) => ({ agentPanelOpen: !state.agentPanelOpen })),
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
  setTheme: (theme) => {
    try { localStorage.setItem('lava-theme', theme) } catch {}
    set({ theme })
  },
}))
