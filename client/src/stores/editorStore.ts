import { create } from 'zustand'
import { useLeadSheetStore } from '@/stores/leadSheetStore'

export type ToolMode = 'pointer' | 'range' | 'chord' | 'keySig' | 'text'
export type ViewMode = 'staff' | 'tab' | 'leadSheet'
export type SaveStatus = 'saved' | 'saving' | 'unsaved'
export type PlaybackState = 'stopped' | 'playing' | 'paused'
export type EditorMode = 'transform' | 'fineEdit'

export interface NoteRef {
  barIndex: number
  noteIndex: number
}

const MAX_UNDO_STACK = 50

interface EditorStore {
  // Tool
  toolMode: ToolMode
  setToolMode: (mode: ToolMode) => void

  // Mode
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void

  // Selection
  selectedBars: number[]
  selectBar: (bar: number, additive?: boolean) => void
  selectRange: (start: number, end: number) => void
  clearSelection: () => void

  // Note-level selection (mutually exclusive with bar selection)
  selectedNotes: NoteRef[]
  selectNote: (barIndex: number, noteIndex: number, additive?: boolean) => void
  clearNoteSelection: () => void

  // Clipboard
  clipboard: string | null
  setClipboard: (fragment: string | null) => void

  // Training wheels
  showChordDiagrams: boolean
  showBeatMarkers: boolean
  toggleChordDiagrams: () => void
  toggleBeatMarkers: () => void

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

  // Playback position (synced from audioStore for score highlighting)
  currentBar: number
  playbackState: PlaybackState
  setCurrentBar: (bar: number) => void
  setPlaybackState: (state: PlaybackState) => void

  // Save
  saveStatus: SaveStatus
  setSaveStatus: (status: SaveStatus) => void
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Tool
  toolMode: 'pointer',
  setToolMode: (mode) => set({ toolMode: mode }),

  // Mode
  editorMode: 'transform',
  setEditorMode: (mode) => set({ editorMode: mode }),

  // Selection
  selectedBars: [],
  selectBar: (bar, additive) => {
    set((s) => {
      if (additive) {
        const has = s.selectedBars.includes(bar)
        return {
          selectedBars: has
            ? s.selectedBars.filter((b) => b !== bar)
            : [...s.selectedBars, bar],
          selectedNotes: [], // mutual exclusion
        }
      }
      return { selectedBars: [bar], selectedNotes: [] } // mutual exclusion
    })
  },
  selectRange: (start, end) => {
    const bars: number[] = []
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    for (let i = lo; i <= hi; i++) bars.push(i)
    set({ selectedBars: bars, selectedNotes: [] })
  },
  clearSelection: () => set({ selectedBars: [], selectedNotes: [] }),

  // Note selection
  selectedNotes: [],
  selectNote: (barIndex, noteIndex, additive) => {
    set((s) => {
      const ref: NoteRef = { barIndex, noteIndex }
      const exists = s.selectedNotes.findIndex(
        (n) => n.barIndex === barIndex && n.noteIndex === noteIndex
      )
      let next: NoteRef[]
      if (additive) {
        next = exists >= 0
          ? s.selectedNotes.filter((_, i) => i !== exists)
          : [...s.selectedNotes, ref]
      } else {
        next = [ref]
      }
      return { selectedNotes: next, selectedBars: [] } // mutual exclusion
    })
  },
  clearNoteSelection: () => set({ selectedNotes: [] }),

  // Clipboard
  clipboard: null,
  setClipboard: (fragment) => set({ clipboard: fragment }),

  // Training wheels
  showChordDiagrams: false,
  showBeatMarkers: false,
  toggleChordDiagrams: () => set((s) => ({ showChordDiagrams: !s.showChordDiagrams })),
  toggleBeatMarkers: () => set((s) => ({ showBeatMarkers: !s.showBeatMarkers })),

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
    set((s) => {
      if (s.undoStack.length === 0) return s
      const currentXml = useLeadSheetStore.getState().musicXml ?? ''
      const prevXml = s.undoStack[s.undoStack.length - 1]
      useLeadSheetStore.getState().setMusicXml(prevXml)
      return {
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, currentXml],
      }
    })
    return null
  },
  redo: () => {
    set((s) => {
      if (s.redoStack.length === 0) return s
      const currentXml = useLeadSheetStore.getState().musicXml ?? ''
      const nextXml = s.redoStack[s.redoStack.length - 1]
      useLeadSheetStore.getState().setMusicXml(nextXml)
      return {
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, currentXml],
      }
    })
    return null
  },
  // Panels
  chatPanelWidth: 380,
  setChatPanelWidth: (width) =>
    set({ chatPanelWidth: Math.max(320, Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.5 : 800, width)) }),
  chatPanelCollapsed: false,
  toggleChatPanel: () => set((state) => ({ chatPanelCollapsed: !state.chatPanelCollapsed })),
  dawPanelExpanded: false,
  toggleDawPanel: () => set((state) => ({ dawPanelExpanded: !state.dawPanelExpanded })),

  // Playback position
  currentBar: -1,
  playbackState: 'stopped' as PlaybackState,
  setCurrentBar: (bar) => set({ currentBar: bar }),
  setPlaybackState: (state) => set({ playbackState: state }),

  // Save
  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),
}))
