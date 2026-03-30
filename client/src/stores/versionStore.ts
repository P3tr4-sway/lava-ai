import { create } from 'zustand'
import type { Version } from '@lava/shared'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useEditorStore } from '@/stores/editorStore'

interface VersionStore {
  versions: Version[]
  activeVersionId: string
  previewVersionId: string | null

  // Patch session (live agent editing)
  patchSessionBaseXml: string | null
  isPatchSession: boolean

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
  startPatchSession: () => void
  endPatchSession: (versionId: string, name: string, changeSummary: string[]) => void
  rollbackPatchSession: () => void
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  versions: [],
  activeVersionId: 'original',
  previewVersionId: null,
  patchSessionBaseXml: null,
  isPatchSession: false,

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
    const { previewVersionId, versions, patchSessionBaseXml } = get()
    if (!previewVersionId) return
    const version = versions.find((v) => v.id === previewVersionId)
    if (version) {
      useLeadSheetStore.getState().setMusicXml(version.musicXml)
    }
    // If this was a patch session, push the pre-session XML as a single undo entry
    if (patchSessionBaseXml !== null) {
      useEditorStore.getState().pushUndo(patchSessionBaseXml)
    }
    set({ activeVersionId: previewVersionId, previewVersionId: null, patchSessionBaseXml: null })
  },

  applyVersion: (id) => {
    const { versions } = get()
    const version = versions.find((v) => v.id === id)
    if (!version) return
    useLeadSheetStore.getState().setMusicXml(version.musicXml)
    set({ activeVersionId: id, previewVersionId: null })
  },

  discardPreview: () => {
    const { previewVersionId, versions, activeVersionId, patchSessionBaseXml } = get()
    if (!previewVersionId) return

    // If this was a patch session, restore the pre-session XML
    if (patchSessionBaseXml !== null) {
      useLeadSheetStore.getState().setMusicXml(patchSessionBaseXml)
    } else {
      const activeVersion = versions.find((v) => v.id === activeVersionId)
      if (activeVersion) {
        useLeadSheetStore.getState().setMusicXml(activeVersion.musicXml)
      }
    }

    set({
      previewVersionId: null,
      patchSessionBaseXml: null,
      isPatchSession: false,
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

  reset: () =>
    set({
      versions: [],
      activeVersionId: 'original',
      previewVersionId: null,
      patchSessionBaseXml: null,
      isPatchSession: false,
    }),

  startPatchSession: () => {
    const currentXml = useLeadSheetStore.getState().musicXml
    set({ patchSessionBaseXml: currentXml, isPatchSession: true })
  },

  endPatchSession: (versionId, name, changeSummary) => {
    const finalXml = useLeadSheetStore.getState().musicXml ?? ''

    // Create the version from the current (patched) XML
    const version: Version = {
      id: versionId,
      name,
      source: 'ai-transform',
      musicXml: finalXml,
      createdAt: Date.now(),
    }

    set((s) => ({
      versions: [...s.versions, version],
      isPatchSession: false,
      // Keep patchSessionBaseXml — needed for undo if user applies
    }))

    // Enter preview mode (shows PreviewBar with Apply/Discard)
    get().startPreview(versionId)
  },

  rollbackPatchSession: () => {
    const { patchSessionBaseXml } = get()
    if (patchSessionBaseXml !== null) {
      useLeadSheetStore.getState().setMusicXml(patchSessionBaseXml)
    }
    set({ patchSessionBaseXml: null, isPatchSession: false })
  },
}))
