import { create } from 'zustand'

export type ToolMode = 'pointer' | 'range' | 'chord' | 'keySig' | 'text'
export type ViewMode = 'staff' | 'tab' | 'leadSheet'
export type SaveStatus = 'saved' | 'saving' | 'unsaved'

const MAX_UNDO_STACK = 50

interface EditorStore {
  // Tool
  toolMode: ToolMode
  setToolMode: (mode: ToolMode) => void

  // Selection
  selectedBars: number[]
  selectBar: (bar: number, additive?: boolean) => void
  selectRange: (start: number, end: number) => void
  clearSelection: () => void

  // View
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  zoom: number
  setZoom: (zoom: number) => void

  // Undo / Redo
  undoStack: string[]
  redoStack: string[]
  pushUndo: (snapshot: string) => void
  undo: () => string | null
  redo: () => string | null
  // Panels
  chatPanelWidth: number
  setChatPanelWidth: (width: number) => void
  chatPanelCollapsed: boolean
  toggleChatPanel: () => void
  dawPanelExpanded: boolean
  toggleDawPanel: () => void

  // Save
  saveStatus: SaveStatus
  setSaveStatus: (status: SaveStatus) => void
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Tool
  toolMode: 'pointer',
  setToolMode: (mode) => set({ toolMode: mode }),

  // Selection
  selectedBars: [],
  selectBar: (bar, additive = false) =>
    set((state) => ({
      selectedBars: additive
        ? state.selectedBars.includes(bar)
          ? state.selectedBars.filter((b) => b !== bar)
          : [...state.selectedBars, bar]
        : [bar],
    })),
  selectRange: (start, end) => {
    const bars: number[] = []
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    for (let i = lo; i <= hi; i++) bars.push(i)
    set({ selectedBars: bars })
  },
  clearSelection: () => set({ selectedBars: [] }),

  // View
  viewMode: 'staff',
  setViewMode: (mode) => set({ viewMode: mode }),
  zoom: 100,
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(200, zoom)) }),

  // Undo / Redo
  undoStack: [],
  redoStack: [],
  pushUndo: (snapshot) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), snapshot],
      redoStack: [],
    })),
  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return null
    const snapshot = undoStack[undoStack.length - 1]
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, snapshot],
    })
    return snapshot
  },
  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return null
    const snapshot = redoStack[redoStack.length - 1]
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, snapshot],
    })
    return snapshot
  },
  // Panels
  chatPanelWidth: 380,
  setChatPanelWidth: (width) =>
    set({ chatPanelWidth: Math.max(320, Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.5 : 800, width)) }),
  chatPanelCollapsed: false,
  toggleChatPanel: () => set((state) => ({ chatPanelCollapsed: !state.chatPanelCollapsed })),
  dawPanelExpanded: false,
  toggleDawPanel: () => set((state) => ({ dawPanelExpanded: !state.dawPanelExpanded })),

  // Save
  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),
}))
