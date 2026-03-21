import { create } from 'zustand'

export type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom'

export interface LeadSheetMeasure {
  id: string
  chords: string[]  // e.g. ["Am7", "D7"] — 1-2 chords per measure
  barline?: 'single' | 'double' | 'repeat-start' | 'repeat-end'
}

export interface LeadSheetSection {
  id: string
  label: string
  type: SectionType
  measures: LeadSheetMeasure[]
}

function makeMeasure(): LeadSheetMeasure {
  return { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, chords: [] }
}

function makeSection(type: SectionType, label: string, barCount = 8): LeadSheetSection {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    type,
    measures: Array.from({ length: barCount }, makeMeasure),
  }
}

interface LeadSheetStore {
  projectName: string
  key: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  pdfUrl: string | null

  // Editing state
  activeCell: { sectionId: string; measureId: string } | null

  setProjectName: (name: string) => void
  setKey: (key: string) => void
  setTempo: (bpm: number) => void
  setTimeSignature: (ts: string) => void
  setPdfUrl: (url: string | null) => void

  addSection: (type: SectionType, label?: string) => void
  removeSection: (id: string) => void
  updateSectionLabel: (id: string, label: string) => void

  setChord: (sectionId: string, measureId: string, chords: string[]) => void
  addMeasure: (sectionId: string) => void
  removeMeasure: (sectionId: string, measureId: string) => void

  setActiveCell: (sectionId: string, measureId: string) => void
  clearActiveCell: () => void

  reset: () => void
}

const INITIAL_SECTIONS: LeadSheetSection[] = [
  makeSection('intro', 'Intro', 4),
  makeSection('verse', 'Verse 1', 8),
  makeSection('chorus', 'Chorus', 8),
]

export const useLeadSheetStore = create<LeadSheetStore>((set) => ({
  projectName: 'Untitled Sheet',
  key: 'C',
  tempo: 120,
  timeSignature: '4/4',
  sections: INITIAL_SECTIONS,
  pdfUrl: null,
  activeCell: null,

  setProjectName: (name) => set({ projectName: name }),
  setKey: (key) => set({ key }),
  setTempo: (tempo) => set({ tempo }),
  setTimeSignature: (timeSignature) => set({ timeSignature }),
  setPdfUrl: (pdfUrl) => set({ pdfUrl }),

  addSection: (type, label) =>
    set((state) => ({
      sections: [...state.sections, makeSection(type, label ?? type.charAt(0).toUpperCase() + type.slice(1), 8)],
    })),

  removeSection: (id) =>
    set((state) => ({ sections: state.sections.filter((s) => s.id !== id) })),

  updateSectionLabel: (id, label) =>
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, label } : s)),
    })),

  setChord: (sectionId, measureId, chords) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              measures: s.measures.map((m) =>
                m.id === measureId ? { ...m, chords } : m,
              ),
            },
      ),
    })),

  addMeasure: (sectionId) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, measures: [...s.measures, makeMeasure()] },
      ),
    })),

  removeMeasure: (sectionId, measureId) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, measures: s.measures.filter((m) => m.id !== measureId) },
      ),
    })),

  setActiveCell: (sectionId, measureId) => set({ activeCell: { sectionId, measureId } }),
  clearActiveCell: () => set({ activeCell: null }),

  reset: () =>
    set({
      projectName: 'Untitled Sheet',
      key: 'C',
      tempo: 120,
      timeSignature: '4/4',
      sections: [
        makeSection('intro', 'Intro', 4),
        makeSection('verse', 'Verse 1', 8),
        makeSection('chorus', 'Chorus', 8),
      ],
      pdfUrl: null,
      activeCell: null,
    }),
}))
