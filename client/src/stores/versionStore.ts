import { create } from 'zustand'
import type { Version } from '@lava/shared'
import { useLeadSheetStore } from '@/stores/leadSheetStore'

interface VersionStore {
  versions: Version[]
  activeVersionId: string
  previewVersionId: string | null

  // Queries
  getActiveVersion: () => Version | undefined
  getPreviewVersion: () => Version | undefined
  isPreview: () => boolean

  // Actions
  setActiveVersion: (id: string) => void
  addVersion: (version: Version) => void
  removeVersion: (id: string) => void
  startPreview: (id: string) => void
  applyPreview: () => void
  applyVersion: (id: string) => void
  discardPreview: () => void
  loadFromArrangements: () => void
  reset: () => void
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  versions: [],
  activeVersionId: 'original',
  previewVersionId: null,

  getActiveVersion: () => {
    const { versions, activeVersionId } = get()
    return versions.find((v) => v.id === activeVersionId)
  },

  getPreviewVersion: () => {
    const { versions, previewVersionId } = get()
    if (!previewVersionId) return undefined
    return versions.find((v) => v.id === previewVersionId)
  },

  isPreview: () => get().previewVersionId !== null,

  setActiveVersion: (id) => {
    if (get().previewVersionId) return
    const version = get().versions.find((v) => v.id === id)
    if (!version) return
    set({ activeVersionId: id })
    useLeadSheetStore.getState().setMusicXml(version.musicXml)
    // Sync arrangement selection for tier 1 versions
    if (version.source === 'arrangement' && version.arrangementId) {
      useLeadSheetStore.getState().selectArrangement(version.arrangementId)
    }
  },

  addVersion: (version) => {
    set((s) => ({ versions: [...s.versions, version] }))
  },

  removeVersion: (id) => {
    set((s) => ({
      versions: s.versions.filter((v) => v.id !== id),
      previewVersionId: s.previewVersionId === id ? null : s.previewVersionId,
    }))
  },

  startPreview: (id) => {
    const version = get().versions.find((v) => v.id === id)
    if (!version) return
    set({ previewVersionId: id })
    useLeadSheetStore.getState().setMusicXml(version.musicXml)
  },

  applyPreview: () => {
    const { previewVersionId, versions } = get()
    if (!previewVersionId) return
    const version = versions.find((v) => v.id === previewVersionId)
    if (version) {
      useLeadSheetStore.getState().setMusicXml(version.musicXml)
    }
    set({ activeVersionId: previewVersionId, previewVersionId: null })
  },

  applyVersion: (id) => {
    const { versions } = get()
    const version = versions.find((v) => v.id === id)
    if (!version) return
    useLeadSheetStore.getState().setMusicXml(version.musicXml)
    set({ activeVersionId: id, previewVersionId: null })
  },

  discardPreview: () => {
    const { previewVersionId, versions, activeVersionId } = get()
    if (!previewVersionId) return
    const activeVersion = versions.find((v) => v.id === activeVersionId)
    if (activeVersion) {
      useLeadSheetStore.getState().setMusicXml(activeVersion.musicXml)
    }
    set({
      previewVersionId: null,
      versions: versions.filter((v) => v.id !== previewVersionId),
    })
  },

  loadFromArrangements: () => {
    const { arrangements, musicXml } = useLeadSheetStore.getState()
    const versions: Version[] = []

    // Always create an "Original" version from the current MusicXML
    if (musicXml) {
      versions.push({
        id: 'original',
        name: 'Original',
        source: 'arrangement',
        arrangementId: 'original',
        musicXml,
        createdAt: Date.now(),
      })
    }

    // Create versions from other arrangements (they share the same MusicXML base for now)
    for (const arr of arrangements) {
      if (arr.id === 'original') continue
      versions.push({
        id: `arrangement-${arr.id}`,
        name: arr.label,
        source: 'arrangement',
        arrangementId: arr.id,
        musicXml: musicXml ?? '',
        createdAt: Date.now(),
      })
    }

    set({ versions, activeVersionId: 'original', previewVersionId: null })
  },

  reset: () => set({ versions: [], activeVersionId: 'original', previewVersionId: null }),
}))
