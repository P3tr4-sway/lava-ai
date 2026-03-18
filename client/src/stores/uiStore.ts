import { create } from 'zustand'

interface UIStore {
  agentPanelOpen: boolean
  sidebarCollapsed: boolean
  activeModal: string | null

  toggleAgentPanel: () => void
  setAgentPanelOpen: (open: boolean) => void
  toggleSidebar: () => void
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  agentPanelOpen: false,
  sidebarCollapsed: false,
  activeModal: null,

  toggleAgentPanel: () => set((state) => ({ agentPanelOpen: !state.agentPanelOpen })),
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}))
