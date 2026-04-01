import { create } from 'zustand'
import type { ScoreCommand, ScoreCommandPatch, ScoreDocument } from '@lava/shared'
import { applyCommandPatch, applyCommandToDocument, buildScoreDigest, cloneScoreDocument, createEmptyScoreDocument, exportScoreDocumentToMusicXml, parseMusicXmlToScoreDocument } from '@/lib/scoreDocument'
import { useLeadSheetStore } from '@/stores/leadSheetStore'

interface ScoreDocumentStore {
  document: ScoreDocument
  exportCacheXml: string
  undoStack: ScoreDocument[]
  redoStack: ScoreDocument[]
  lastWarnings: string[]
  loadFromMusicXml: (xml: string | null | undefined) => void
  loadFromSnapshot: (document: ScoreDocument | null | undefined) => void
  applyCommand: (command: ScoreCommand, recordHistory?: boolean) => void
  applyCommandPatch: (patch: ScoreCommandPatch, recordHistory?: boolean) => void
  setDocument: (document: ScoreDocument, recordHistory?: boolean) => void
  pushUndoSnapshot: (document: ScoreDocument) => void
  undo: () => void
  redo: () => void
  reset: () => void
  getDigest: () => string
}

function syncLeadSheetMetadata(document: ScoreDocument, exportCacheXml: string) {
  const leadSheetStore = useLeadSheetStore.getState()
  const track = document.tracks[0]
  leadSheetStore.setMusicXml(exportCacheXml)
  leadSheetStore.setTempo(document.tempo)
  leadSheetStore.setTimeSignature(`${document.meter.numerator}/${document.meter.denominator}`)
  leadSheetStore.setKey(document.keySignature.key)
  if (track) {
    const selectedArrangement = leadSheetStore.arrangements.find((entry) => entry.id === leadSheetStore.selectedArrangementId)
    if (selectedArrangement) {
      selectedArrangement.capoFret = track.capo
    }
  }
}

const INITIAL_DOCUMENT = createEmptyScoreDocument()
const INITIAL_XML = exportScoreDocumentToMusicXml(INITIAL_DOCUMENT)

export const useScoreDocumentStore = create<ScoreDocumentStore>((set, get) => ({
  document: INITIAL_DOCUMENT,
  exportCacheXml: INITIAL_XML,
  undoStack: [],
  redoStack: [],
  lastWarnings: [],

  loadFromMusicXml: (xml) => {
    const document = xml ? parseMusicXmlToScoreDocument(xml) : createEmptyScoreDocument()
    const exportCacheXml = exportScoreDocumentToMusicXml(document)
    syncLeadSheetMetadata(document, exportCacheXml)
    set({
      document,
      exportCacheXml,
      undoStack: [],
      redoStack: [],
      lastWarnings: [],
    })
  },

  loadFromSnapshot: (document) => {
    const nextDocument = document ? cloneScoreDocument(document) : createEmptyScoreDocument()
    const exportCacheXml = exportScoreDocumentToMusicXml(nextDocument)
    syncLeadSheetMetadata(nextDocument, exportCacheXml)
    set({
      document: nextDocument,
      exportCacheXml,
      undoStack: [],
      redoStack: [],
      lastWarnings: [],
    })
  },

  applyCommand: (command, recordHistory = true) => {
    const current = get().document
    const result = applyCommandToDocument(current, command)
    syncLeadSheetMetadata(result.document, result.document.lastExportedXml ?? exportScoreDocumentToMusicXml(result.document))
    set((state) => ({
      document: result.document,
      exportCacheXml: result.document.lastExportedXml ?? exportScoreDocumentToMusicXml(result.document),
      lastWarnings: result.warnings,
      undoStack: recordHistory ? [...state.undoStack, cloneScoreDocument(current)].slice(-50) : state.undoStack,
      redoStack: recordHistory ? [] : state.redoStack,
    }))
  },

  applyCommandPatch: (patch, recordHistory = true) => {
    const current = get().document
    const result = applyCommandPatch(current, patch)
    syncLeadSheetMetadata(result.document, result.document.lastExportedXml ?? exportScoreDocumentToMusicXml(result.document))
    set((state) => ({
      document: result.document,
      exportCacheXml: result.document.lastExportedXml ?? exportScoreDocumentToMusicXml(result.document),
      lastWarnings: result.warnings,
      undoStack: recordHistory ? [...state.undoStack, cloneScoreDocument(current)].slice(-50) : state.undoStack,
      redoStack: recordHistory ? [] : state.redoStack,
    }))
  },

  setDocument: (document, recordHistory = true) => {
    const current = get().document
    const nextDocument = cloneScoreDocument(document)
    const exportCacheXml = exportScoreDocumentToMusicXml(nextDocument)
    syncLeadSheetMetadata(nextDocument, exportCacheXml)
    set((state) => ({
      document: nextDocument,
      exportCacheXml,
      lastWarnings: [],
      undoStack: recordHistory ? [...state.undoStack, cloneScoreDocument(current)].slice(-50) : state.undoStack,
      redoStack: recordHistory ? [] : state.redoStack,
    }))
  },

  pushUndoSnapshot: (document) => {
    set((state) => ({
      undoStack: [...state.undoStack, cloneScoreDocument(document)].slice(-50),
      redoStack: [],
    }))
  },

  undo: () => {
    const { undoStack, document, redoStack } = get()
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    const exportCacheXml = exportScoreDocumentToMusicXml(previous)
    syncLeadSheetMetadata(previous, exportCacheXml)
    set({
      document: previous,
      exportCacheXml,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cloneScoreDocument(document)].slice(-50),
      lastWarnings: [],
    })
  },

  redo: () => {
    const { redoStack, document, undoStack } = get()
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    const exportCacheXml = exportScoreDocumentToMusicXml(next)
    syncLeadSheetMetadata(next, exportCacheXml)
    set({
      document: next,
      exportCacheXml,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, cloneScoreDocument(document)].slice(-50),
      lastWarnings: [],
    })
  },

  reset: () => {
    syncLeadSheetMetadata(INITIAL_DOCUMENT, INITIAL_XML)
    set({
      document: createEmptyScoreDocument(),
      exportCacheXml: INITIAL_XML,
      undoStack: [],
      redoStack: [],
      lastWarnings: [],
    })
  },

  getDigest: () => buildScoreDigest(get().document),
}))
