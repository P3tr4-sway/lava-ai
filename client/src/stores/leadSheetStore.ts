import { create } from 'zustand'
import {
  ARRANGEMENT_COPY,
  type ArrangementId,
  type LeadSheetMeasure,
  type LeadSheetSection,
  type LeadSheetSectionType,
  type PlayableArrangement,
  type Project,
} from '@lava/shared'

export type SectionType = LeadSheetSectionType
export type { LeadSheetMeasure, LeadSheetSection }

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

function createOriginalArrangement(data: {
  key: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
}): PlayableArrangement {
  return {
    id: 'original',
    ...ARRANGEMENT_COPY.original,
    concertKey: data.key,
    displayKey: data.key,
    tempo: data.tempo,
    timeSignature: data.timeSignature,
    sections: data.sections,
    changeSummary: ['Full changes', 'Full form'],
    format: 'lead_sheet',
  }
}

function getArrangementById(arrangements: PlayableArrangement[], id: ArrangementId | null): PlayableArrangement {
  if (id) {
    const exact = arrangements.find((arrangement) => arrangement.id === id)
    if (exact) return exact
  }
  return arrangements[0] ?? createOriginalArrangement({
    key: 'C',
    tempo: 120,
    timeSignature: '4/4',
    sections: [
      makeSection('intro', 'Intro', 4),
      makeSection('verse', 'Verse 1', 8),
      makeSection('chorus', 'Chorus', 8),
    ],
  })
}

function projectArrangement(arrangement: PlayableArrangement) {
  return {
    key: arrangement.concertKey,
    tempo: arrangement.tempo,
    timeSignature: arrangement.timeSignature,
    sections: arrangement.sections,
  }
}

function normalizeArrangements(data: {
  key: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  arrangements?: PlayableArrangement[]
}): PlayableArrangement[] {
  if (data.arrangements && data.arrangements.length > 0) return data.arrangements
  return [createOriginalArrangement(data)]
}

interface LeadSheetStore {
  projectName: string
  key: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  pdfUrl: string | null
  musicXml: string | null
  arrangements: PlayableArrangement[]
  selectedArrangementId: ArrangementId
  scoreView: 'lead_sheet' | 'staff' | 'tab'
  arrangementPickerOpen: boolean

  // Editing state
  activeCell: { sectionId: string; measureId: string } | null

  setProjectName: (name: string) => void
  setKey: (key: string) => void
  setTempo: (bpm: number) => void
  setTimeSignature: (ts: string) => void
  setPdfUrl: (url: string | null) => void
  setMusicXml: (xml: string | null) => void
  selectArrangement: (id: ArrangementId) => void
  setScoreView: (view: 'lead_sheet' | 'staff' | 'tab') => void
  openArrangementPicker: () => void
  closeArrangementPicker: () => void
  toggleArrangementPicker: () => void

  addSection: (type: SectionType, label?: string) => void
  removeSection: (id: string) => void
  updateSectionLabel: (id: string, label: string) => void

  setChord: (sectionId: string, measureId: string, chords: string[]) => void
  addMeasure: (sectionId: string) => void
  removeMeasure: (sectionId: string, measureId: string) => void

  setActiveCell: (sectionId: string, measureId: string) => void
  clearActiveCell: () => void

  loadFromAnalysis: (data: {
    projectName: string
    key: string
    tempo: number
    timeSignature: string
    sections: LeadSheetSection[]
    arrangements?: PlayableArrangement[]
    defaultArrangementId?: ArrangementId
  }) => void

  loadFromProject: (project: Project) => void

  reset: () => void
}

const INITIAL_SECTIONS: LeadSheetSection[] = [
  makeSection('intro', 'Intro', 4),
  makeSection('verse', 'Verse 1', 8),
  makeSection('chorus', 'Chorus', 8),
]

const INITIAL_ARRANGEMENTS = [createOriginalArrangement({
  key: 'C',
  tempo: 120,
  timeSignature: '4/4',
  sections: INITIAL_SECTIONS,
})]

function updateSelectedArrangement(
  state: LeadSheetStore,
  updater: (arrangement: PlayableArrangement) => PlayableArrangement,
) {
  const arrangements = state.arrangements.map((arrangement) =>
    arrangement.id === state.selectedArrangementId ? updater(arrangement) : arrangement,
  )
  const selected = getArrangementById(arrangements, state.selectedArrangementId)

  return {
    arrangements,
    ...projectArrangement(selected),
  }
}

export const useLeadSheetStore = create<LeadSheetStore>((set) => ({
  projectName: 'Untitled Sheet',
  key: 'C',
  tempo: 120,
  timeSignature: '4/4',
  sections: INITIAL_SECTIONS,
  pdfUrl: null,
  musicXml: null,
  arrangements: INITIAL_ARRANGEMENTS,
  selectedArrangementId: 'original',
  scoreView: 'lead_sheet',
  arrangementPickerOpen: false,
  activeCell: null,

  setProjectName: (name) => set({ projectName: name }),
  setKey: (key) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        concertKey: key,
      })),
      key,
    })),
  setTempo: (tempo) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        tempo,
      })),
      tempo,
    })),
  setTimeSignature: (timeSignature) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        timeSignature,
      })),
      timeSignature,
    })),
  setPdfUrl: (pdfUrl) => set({ pdfUrl }),
  setMusicXml: (musicXml) => set({ musicXml }),
  selectArrangement: (id) =>
    set((state) => {
      const selected = getArrangementById(state.arrangements, id)
      return {
        selectedArrangementId: selected.id,
        scoreView: selected.id === 'original' ? state.scoreView : state.scoreView === 'staff' ? 'lead_sheet' : state.scoreView,
        ...projectArrangement(selected),
        activeCell: null,
      }
    }),
  setScoreView: (scoreView) =>
    set((state) => {
      if (scoreView !== 'staff') return { scoreView }

      const original = state.arrangements.find((arrangement) => arrangement.id === 'original')
      if (!original) return { scoreView }

      return {
        scoreView,
        selectedArrangementId: 'original',
        ...projectArrangement(original),
        activeCell: null,
      }
    }),
  openArrangementPicker: () => set({ arrangementPickerOpen: true }),
  closeArrangementPicker: () => set({ arrangementPickerOpen: false }),
  toggleArrangementPicker: () => set((state) => ({ arrangementPickerOpen: !state.arrangementPickerOpen })),

  addSection: (type, label) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        sections: [...arrangement.sections, makeSection(type, label ?? type.charAt(0).toUpperCase() + type.slice(1), 8)],
      })),
    })),

  removeSection: (id) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        sections: arrangement.sections.filter((section) => section.id !== id),
      })),
    })),

  updateSectionLabel: (id, label) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        sections: arrangement.sections.map((section) => (section.id === id ? { ...section, label } : section)),
      })),
    })),

  setChord: (sectionId, measureId, chords) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        sections: arrangement.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                measures: section.measures.map((measure) =>
                  measure.id === measureId ? { ...measure, chords } : measure,
                ),
              },
        ),
      })),
    })),

  addMeasure: (sectionId) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        sections: arrangement.sections.map((section) =>
          section.id !== sectionId ? section : { ...section, measures: [...section.measures, makeMeasure()] },
        ),
      })),
    })),

  removeMeasure: (sectionId, measureId) =>
    set((state) => ({
      ...updateSelectedArrangement(state, (arrangement) => ({
        ...arrangement,
        sections: arrangement.sections.map((section) =>
          section.id !== sectionId
            ? section
            : { ...section, measures: section.measures.filter((measure) => measure.id !== measureId) },
        ),
      })),
    })),

  setActiveCell: (sectionId, measureId) => set({ activeCell: { sectionId, measureId } }),
  clearActiveCell: () => set({ activeCell: null }),

  loadFromAnalysis: (data) =>
    set(() => {
      const arrangements = normalizeArrangements(data)
      const selected = getArrangementById(arrangements, data.defaultArrangementId ?? arrangements.find((arrangement) => arrangement.recommended)?.id ?? arrangements[0]?.id ?? 'original')

      return {
        projectName: data.projectName,
        pdfUrl: null,
        arrangements,
        selectedArrangementId: selected.id,
        scoreView: 'lead_sheet',
        arrangementPickerOpen: false,
        ...projectArrangement(selected),
        activeCell: null,
      }
    }),

  loadFromProject: (project) => {
    const metadata = project.metadata
    const sections = Array.isArray(metadata.sections)
      ? (metadata.sections as Array<{ id: string; type: string; label: string; measures: Array<{ id: string; chords: string[] }> }>).map((section) => ({
          id: section.id,
          label: section.label,
          type: section.type as SectionType,
          measures: section.measures.map((measure) => ({ id: measure.id, chords: measure.chords ?? [] })),
        }))
      : [makeSection('intro', 'Intro', 4), makeSection('verse', 'Verse 1', 8), makeSection('chorus', 'Chorus', 8)]

    const key = typeof metadata.key === 'string' ? metadata.key : 'C'
    const tempo = typeof metadata.tempo === 'number' ? metadata.tempo : typeof metadata.bpm === 'number' ? metadata.bpm : 120
    const timeSignature = typeof metadata.timeSignature === 'string' ? metadata.timeSignature : '4/4'
    const arrangements = normalizeArrangements({
      key,
      tempo,
      timeSignature,
      sections,
      arrangements: Array.isArray(metadata.arrangements) ? metadata.arrangements as PlayableArrangement[] : undefined,
    })
    const selected = getArrangementById(
      arrangements,
      typeof metadata.selectedArrangementId === 'string' ? metadata.selectedArrangementId as ArrangementId : arrangements[0]?.id ?? 'original',
    )

    set({
      projectName: project.name,
      pdfUrl: typeof metadata.pdfUrl === 'string' ? metadata.pdfUrl : null,
      musicXml: typeof metadata.musicXml === 'string' ? metadata.musicXml : null,
      arrangements,
      selectedArrangementId: selected.id,
      scoreView: typeof metadata.scoreView === 'string' && ['lead_sheet', 'staff', 'tab'].includes(metadata.scoreView)
        ? metadata.scoreView as 'lead_sheet' | 'staff' | 'tab'
        : 'lead_sheet',
      arrangementPickerOpen: false,
      ...projectArrangement(selected),
      activeCell: null,
    })
  },

  reset: () => {
    const selected = INITIAL_ARRANGEMENTS[0]
    set({
      projectName: 'Untitled Sheet',
      pdfUrl: null,
      musicXml: null,
      arrangements: INITIAL_ARRANGEMENTS,
      selectedArrangementId: 'original',
      scoreView: 'lead_sheet',
      arrangementPickerOpen: false,
      ...projectArrangement(selected),
      activeCell: null,
    })
  },
}))
