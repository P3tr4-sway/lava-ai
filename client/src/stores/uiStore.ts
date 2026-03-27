import { create } from 'zustand'

type Theme = 'system' | 'light' | 'dark'
type AgentPanelDesktopMode = 'expanded' | 'collapsed'

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

function readAgentPanelDesktopMode(): AgentPanelDesktopMode {
  try {
    const v = localStorage.getItem('lava-agent-panel-mode')
    if (v === 'expanded' || v === 'collapsed') return v
  } catch {}
  return 'expanded'
}

interface UIStore {
  agentPanelDesktopMode: AgentPanelDesktopMode
  agentPanelMobileOpen: boolean
  sidebarCollapsed: boolean
  sidebarOpen: boolean
  activeModal: string | null
  theme: Theme
  authPromptOpen: boolean
  authPromptAction: string | null

  expandAgentPanel: () => void
  collapseAgentPanel: () => void
  toggleDesktopAgentPanel: () => void
  openMobileAgentPanel: () => void
  closeMobileAgentPanel: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
  setTheme: (theme: Theme) => void
  openAuthPrompt: (action?: string) => void
  closeAuthPrompt: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  agentPanelDesktopMode: readAgentPanelDesktopMode(),
  agentPanelMobileOpen: false,
  sidebarCollapsed: readSidebarCollapsed(),
  sidebarOpen: false,
  activeModal: null,
  theme: readTheme(),

  expandAgentPanel: () => {
    try { localStorage.setItem('lava-agent-panel-mode', 'expanded') } catch {}
    set({ agentPanelDesktopMode: 'expanded' })
  },
  collapseAgentPanel: () => {
    try { localStorage.setItem('lava-agent-panel-mode', 'collapsed') } catch {}
    set({ agentPanelDesktopMode: 'collapsed' })
  },
  toggleDesktopAgentPanel: () =>
    set((state) => {
      const next = state.agentPanelDesktopMode === 'expanded' ? 'collapsed' : 'expanded'
      // 桌面端记住用户的展开/缩小选择，跨页面保持一致。
      try { localStorage.setItem('lava-agent-panel-mode', next) } catch {}
      return { agentPanelDesktopMode: next }
    }),
  openMobileAgentPanel: () => set({ agentPanelMobileOpen: true }),
  closeMobileAgentPanel: () => set({ agentPanelMobileOpen: false }),
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

export type { AgentPanelDesktopMode }
