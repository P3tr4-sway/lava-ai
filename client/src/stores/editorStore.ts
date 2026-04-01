import { create } from 'zustand'
import type { NoteValue } from '@lava/shared'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

export type ToolMode = 'pointer' | 'chord' | 'keySig' | 'text'
export type ViewMode = 'staff' | 'tab' | 'split' | 'leadSheet'
export type SaveStatus = 'saved' | 'saving' | 'unsaved'
export type PlaybackState = 'stopped' | 'playing' | 'paused'
export type EditorMode = 'transform' | 'fineEdit'
export type ActiveToolGroup = 'selection' | 'note' | 'rest' | 'notation' | 'measure' | 'playback'
export type InspectorFocus = 'duration' | 'fretboard' | null

export interface EditorCaret {
  trackId: string
  measureIndex: number
  beat: number
  string: number
}

export interface HoverTarget {
  kind: 'note' | 'bar' | 'beat' | 'section'
  noteId?: string
  measureIndex: number
  beat?: number
  string?: number
}

export interface DragState {
  active: boolean
  mode: 'bar' | null
  startMeasureIndex: number | null
  currentMeasureIndex: number | null
}

export interface NoteRef {
  barIndex: number
  noteIndex: number
}

const MAX_UNDO_STACK = 50

interface EditorStore {
  // Tool
  toolMode: ToolMode
  setToolMode: (mode: ToolMode) => void
  activeToolGroup: ActiveToolGroup
  setActiveToolGroup: (group: ActiveToolGroup) => void
  entryDuration: NoteValue
  setEntryDuration: (duration: NoteValue) => void
  entryMode: 'note' | 'rest'
  setEntryMode: (mode: 'note' | 'rest') => void

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
  selectedNoteIds: string[]
  selectNote: (barIndex: number, noteIndex: number, additive?: boolean) => void
  selectNoteById: (noteId: string, additive?: boolean) => void
  clearNoteSelection: () => void
  cursorNoteId: string | null
  setCursorNoteId: (noteId: string | null) => void
  caret: EditorCaret | null
  setCaret: (caret: EditorCaret | null) => void
  hoverTarget: HoverTarget | null
  setHoverTarget: (target: HoverTarget | null) => void
  dragState: DragState
  setDragState: (state: Partial<DragState>) => void

  // Clipboard
  clipboard: string | null
  setClipboard: (fragment: string | null) => void
  inspectorFocus: InspectorFocus
  requestInspectorFocus: (focus: Exclude<InspectorFocus, null>) => void
  clearInspectorFocus: () => void

  // Training wheels
  showChordDiagrams: boolean
  showBeatMarkers: boolean
  toggleChordDiagrams: () => void
  toggleBeatMarkers: () => void
  chordDiagramGlobal: 'hidden' | 'top' | 'bottom' | 'both'
  setChordDiagramGlobal: (placement: 'hidden' | 'top' | 'bottom' | 'both') => void

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
  activeToolGroup: 'selection',
  setActiveToolGroup: (activeToolGroup) => set({ activeToolGroup }),
  entryDuration: 'quarter',
  setEntryDuration: (entryDuration) => set({ entryDuration }),
  entryMode: 'note',
  setEntryMode: (entryMode) => set({ entryMode }),

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
          selectedNoteIds: [],
          cursorNoteId: null,
          caret: null,
        }
      }
      return {
        selectedBars: [bar],
        selectedNotes: [],
        selectedNoteIds: [],
        cursorNoteId: null,
        caret: null,
      } // mutual exclusion
    })
  },
  selectRange: (start, end) => {
    const bars: number[] = []
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    for (let i = lo; i <= hi; i++) bars.push(i)
    set({ selectedBars: bars, selectedNotes: [], selectedNoteIds: [], cursorNoteId: null, caret: null })
  },
  clearSelection: () => set({ selectedBars: [], selectedNotes: [], selectedNoteIds: [], cursorNoteId: null, caret: null }),

  // Note selection
  selectedNotes: [],
  selectedNoteIds: [],
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
      return { selectedNotes: next, selectedNoteIds: [], selectedBars: [], caret: null } // mutual exclusion
    })
  },
  selectNoteById: (noteId, additive) => {
    const track = useScoreDocumentStore.getState().document.tracks[0]
    const notes = track?.notes ?? []
    const target = notes.find((note) => note.id === noteId)
    if (!target) return
    const inMeasure = notes
      .filter((note) => note.measureIndex === target.measureIndex)
      .sort((a, b) => a.beat - b.beat)
    const noteIndex = inMeasure.findIndex((note) => note.id === noteId)
    set((s) => {
      const nextIds = additive
        ? s.selectedNoteIds.includes(noteId)
          ? s.selectedNoteIds.filter((id) => id !== noteId)
          : [...s.selectedNoteIds, noteId]
        : [noteId]
      const nextRefs = additive
        ? s.selectedNotes.some((note) => note.barIndex === target.measureIndex && note.noteIndex === noteIndex)
          ? s.selectedNotes.filter((note) => !(note.barIndex === target.measureIndex && note.noteIndex === noteIndex))
          : [...s.selectedNotes, { barIndex: target.measureIndex, noteIndex }]
        : [{ barIndex: target.measureIndex, noteIndex }]
      return {
        selectedNotes: nextRefs,
        selectedNoteIds: nextIds,
        cursorNoteId: noteId,
        selectedBars: [],
        caret: null,
      }
    })
  },
  clearNoteSelection: () => set({ selectedNotes: [], selectedNoteIds: [], cursorNoteId: null }),
  cursorNoteId: null,
  setCursorNoteId: (noteId) => set({ cursorNoteId: noteId }),
  caret: null,
  setCaret: (caret) => set({ caret, selectedBars: [], selectedNotes: [], selectedNoteIds: [], cursorNoteId: null }),
  hoverTarget: null,
  setHoverTarget: (hoverTarget) => set({ hoverTarget }),
  dragState: {
    active: false,
    mode: null,
    startMeasureIndex: null,
    currentMeasureIndex: null,
  },
  setDragState: (dragState) => set((state) => ({ dragState: { ...state.dragState, ...dragState } })),

  // Clipboard
  clipboard: null,
  setClipboard: (fragment) => set({ clipboard: fragment }),
  inspectorFocus: null,
  requestInspectorFocus: (inspectorFocus) => set({ inspectorFocus }),
  clearInspectorFocus: () => set({ inspectorFocus: null }),

  // Training wheels
  showChordDiagrams: false,
  showBeatMarkers: false,
  toggleChordDiagrams: () => set((s) => ({ showChordDiagrams: !s.showChordDiagrams })),
  toggleBeatMarkers: () => set((s) => ({ showBeatMarkers: !s.showBeatMarkers })),
  chordDiagramGlobal: 'hidden',
  setChordDiagramGlobal: (chordDiagramGlobal) => set({ chordDiagramGlobal }),

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
    useScoreDocumentStore.getState().undo()
    return null
  },
  redo: () => {
    useScoreDocumentStore.getState().redo()
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
