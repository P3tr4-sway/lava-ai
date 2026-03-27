import { create } from 'zustand'
import type { ToneProjectSnapshot } from '@lava/shared'
import { projectService } from '@/services/projectService'
import { useProjectStore } from './projectStore'
import {
  CATEGORIES,
  type Knob,
  type Pedal,
  type PedalCategory,
  PRESETS,
  buildChainSummary,
  buildKnobSummary,
  createDefaultToneState,
  deserializeToneState,
  findPedal,
} from '@/spaces/jam/toneModel'

export interface ToneProjectMetadata {
  type: 'tone-patch'
  toneState: ToneProjectSnapshot
  agentThread?: {
    id: string
    title: string
    messages: unknown[]
    updatedAt: number
    summary?: string
  }
}

interface ToneStore extends ToneProjectSnapshot {
  projectId?: string
  projectName?: string
  loadedProjectId?: string

  resetDraft: () => void
  setProjectMeta: (projectId?: string, projectName?: string) => void
  loadSnapshot: (snapshot?: Partial<ToneProjectSnapshot> | null, projectId?: string, projectName?: string) => void
  setSelectedSlotId: (slotId: string) => void
  setActiveCategory: (category: PedalCategory) => void
  setSelectedPreset: (presetId: string) => void
  pickPedal: (pedal: Pedal) => void
  setKnobValue: (slotId: string, knobId: string, value: number) => void
  addSlot: () => void
  removeSlot: (slotId: string) => void
  applySnapshot: (snapshot: ToneProjectSnapshot) => void
  getCurrentKnobs: () => Knob[]
  getSelectedPedal: () => Pedal | null
  getToneContextSummary: () => {
    selectedPresetName: string
    chainSummary: string[]
    knobSummary: string[]
    selectedPedalName: string | null
  }
  ensureProject: () => Promise<{ id: string; name: string }>
}

function getPresetName(presetId: string) {
  return PRESETS.find((preset) => preset.id === presetId)?.name ?? 'Custom'
}

function chooseCategoryForSelection(selectedSlotId: string, chain: ToneProjectSnapshot['chain']) {
  const slot = chain.find((item) => item.id === selectedSlotId)
  const pedal = findPedal(slot?.pedalId ?? '')
  return pedal?.category ?? CATEGORIES[0].key
}

function buildProjectName(state: ToneProjectSnapshot) {
  return `${getPresetName(state.selectedPreset)} Tone`
}

function applySnapshotToState(snapshot?: Partial<ToneProjectSnapshot> | null) {
  const next = deserializeToneState(snapshot)
  return {
    selectedPreset: next.selectedPreset,
    selectedSlotId: next.selectedSlotId,
    activeCategory: next.activeCategory as PedalCategory,
    chain: next.chain,
    pedalKnobs: next.pedalKnobs,
  }
}

export const useToneStore = create<ToneStore>((set, get) => ({
  ...createDefaultToneState(),
  projectId: undefined,
  projectName: undefined,
  loadedProjectId: undefined,

  resetDraft: () =>
    set({
      ...createDefaultToneState(),
      projectId: undefined,
      projectName: undefined,
      loadedProjectId: undefined,
    }),

  setProjectMeta: (projectId, projectName) => set({ projectId, projectName }),

  loadSnapshot: (snapshot, projectId, projectName) =>
    set({
      ...applySnapshotToState(snapshot),
      projectId,
      projectName,
      loadedProjectId: projectId,
    }),

  setSelectedSlotId: (slotId) =>
    set((state) => ({
      selectedSlotId: slotId,
      activeCategory: chooseCategoryForSelection(slotId, state.chain) as PedalCategory,
    })),

  setActiveCategory: (category) => set({ activeCategory: category }),

  setSelectedPreset: (presetId) =>
    set(() => {
      const next = deserializeToneState({
        ...createDefaultToneState(),
        selectedPreset: presetId,
        chain: PRESETS.find((preset) => preset.id === presetId)?.chain.map((pedalId, index) => ({
          id: `slot-${index}`,
          pedalId,
        })) ?? createDefaultToneState().chain,
        activeCategory: chooseCategoryForSelection('slot-0', PRESETS.find((preset) => preset.id === presetId)?.chain.map((pedalId, index) => ({
          id: `slot-${index}`,
          pedalId,
        })) ?? createDefaultToneState().chain),
      })
      return applySnapshotToState(next)
    }),

  pickPedal: (pedal) =>
    set((state) => ({
      chain: state.chain.map((slot) =>
        slot.id === state.selectedSlotId ? { ...slot, pedalId: pedal.id } : slot,
      ),
      pedalKnobs: Object.fromEntries(
        Object.entries(state.pedalKnobs).filter(([slotId]) => slotId !== state.selectedSlotId),
      ),
      activeCategory: pedal.category,
    })),

  setKnobValue: (slotId, knobId, value) =>
    set((state) => {
      const slot = state.chain.find((item) => item.id === slotId)
      const pedal = findPedal(slot?.pedalId ?? '')
      if (!pedal) return {}

      const existingKnobs = state.pedalKnobs[slotId] ?? pedal.knobs
      const nextKnobs = existingKnobs.map((knob) =>
        knob.id === knobId ? { ...knob, value } : knob,
      )

      return {
        pedalKnobs: {
          ...state.pedalKnobs,
          [slotId]: nextKnobs,
        },
      }
    }),

  addSlot: () =>
    set((state) => {
      const newSlotId = `slot-${Date.now()}`
      return {
        chain: [...state.chain, { id: newSlotId, pedalId: null }],
        selectedSlotId: newSlotId,
      }
    }),

  removeSlot: (slotId) =>
    set((state) => {
      const nextChain = state.chain.filter((slot) => slot.id !== slotId)
      const nextSelectedSlotId =
        state.selectedSlotId === slotId
          ? nextChain[0]?.id ?? state.selectedSlotId
          : state.selectedSlotId

      return {
        chain: nextChain,
        selectedSlotId: nextSelectedSlotId,
        activeCategory: chooseCategoryForSelection(nextSelectedSlotId, nextChain) as PedalCategory,
        pedalKnobs: Object.fromEntries(
          Object.entries(state.pedalKnobs).filter(([key]) => key !== slotId),
        ),
      }
    }),

  applySnapshot: (snapshot) => set(applySnapshotToState(snapshot)),

  getCurrentKnobs: () => {
    const state = get()
    const slot = state.chain.find((item) => item.id === state.selectedSlotId)
    const pedal = findPedal(slot?.pedalId ?? '')
    if (!pedal) return []
    return state.pedalKnobs[state.selectedSlotId] ?? pedal.knobs
  },

  getSelectedPedal: () => {
    const state = get()
    const slot = state.chain.find((item) => item.id === state.selectedSlotId)
    return findPedal(slot?.pedalId ?? '') ?? null
  },

  getToneContextSummary: () => {
    const state = get()
    return {
      selectedPresetName: getPresetName(state.selectedPreset),
      chainSummary: buildChainSummary(state),
      knobSummary: buildKnobSummary(state),
      selectedPedalName: get().getSelectedPedal()?.name ?? null,
    }
  },

  ensureProject: async () => {
    const state = get()
    if (state.projectId && state.projectName) {
      return { id: state.projectId, name: state.projectName }
    }

    const snapshot: ToneProjectSnapshot = {
      selectedPreset: state.selectedPreset,
      selectedSlotId: state.selectedSlotId,
      activeCategory: state.activeCategory,
      chain: state.chain,
      pedalKnobs: state.pedalKnobs,
    }
    const name = buildProjectName(snapshot)
    const created = await projectService.create({
      name,
      description: 'AI tone patch',
      space: 'tools',
      metadata: {
        type: 'tone-patch',
        toneState: snapshot,
      } as unknown as Record<string, unknown>,
    })

    useProjectStore.getState().upsertProject(created)
    set({
      projectId: created.id,
      projectName: created.name,
      loadedProjectId: created.id,
    })

    return { id: created.id, name: created.name }
  },
}))
