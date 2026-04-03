import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import { useEditorStore } from '@/stores/editorStore'
import type { ScoreCommand } from '@lava/shared'

function getSelectedNoteId(): string | null {
  const { selectedNoteIds } = useEditorStore.getState()
  return selectedNoteIds[0] ?? null
}

function applyCommand(cmd: ScoreCommand) {
  useScoreDocumentStore.getState().applyCommand(cmd)
}

const EVENT_HANDLERS: Record<string, (e: CustomEvent) => void> = {
  'lava-accidental': (e) => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    const { document } = useScoreDocumentStore.getState()
    const allNotes = document.tracks.flatMap((t) => t.notes)
    const note = allNotes.find((n) => n.id === noteId)
    if (!note?.pitch) return
    const trackId = document.tracks.find((t) => t.notes.some((n) => n.id === noteId))?.id
    if (!trackId) return
    applyCommand({
      type: 'setPitch',
      trackId,
      noteId,
      pitch: { ...note.pitch, alter: e.detail.alter ?? undefined },
    })
  },

  'lava-dynamic': (e) => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    const { document } = useScoreDocumentStore.getState()
    const trackId = document.tracks.find((t) => t.notes.some((n) => n.id === noteId))?.id
    if (!trackId) return
    applyCommand({ type: 'setNoteDynamic', trackId, noteId, dynamic: e.detail.dynamic ?? null })
  },

  'lava-toggle-dot': () => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    applyCommand({ type: 'toggleDot', noteId })
  },

  'lava-toggle-triplet': () => {
    const noteId = getSelectedNoteId()
    if (!noteId) return
    applyCommand({ type: 'toggleTuplet', noteId, actual: 3, normal: 2 })
  },

  'lava-transpose': (e) => {
    const { selectedBars } = useEditorStore.getState()
    if (selectedBars.length === 0) return
    const { document } = useScoreDocumentStore.getState()
    const trackId = document.tracks[0]?.id
    if (!trackId) return
    applyCommand({
      type: 'transposeSelection',
      trackId,
      measureRange: [Math.min(...selectedBars), Math.max(...selectedBars)],
      semitones: e.detail.semitones,
    })
  },

  'lava-copy': () => {
    const { selectedBars, selectedNoteIds, setClipboard } = useEditorStore.getState()
    const { document } = useScoreDocumentStore.getState()

    if (selectedBars.length > 0) {
      const minBar = Math.min(...selectedBars)
      const notes = document.tracks
        .flatMap((t) => t.notes)
        .filter((n) => selectedBars.includes(n.measureIndex))
        .map((n) => ({ ...n, measureIndex: n.measureIndex - minBar }))
      const measures = selectedBars
        .map((i) => document.measures[i])
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => ({ ...m, index: m.index - minBar }))
      setClipboard({ notes, measures, sourceMeasureCount: selectedBars.length })
    } else if (selectedNoteIds.length > 0) {
      const notes = document.tracks
        .flatMap((t) => t.notes)
        .filter((n) => selectedNoteIds.includes(n.id))
      setClipboard({ notes, measures: [], sourceMeasureCount: 1 })
    }
  },

  'lava-paste': () => {
    const { clipboard, caret } = useEditorStore.getState()
    if (!clipboard || !caret) return
    applyCommand({
      type: 'pasteSelection',
      targetTrackId: caret.trackId,
      targetMeasureIndex: caret.measureIndex,
      targetBeat: caret.beat,
      clipboard,
    })
  },

  'lava-duplicate': () => {
    // Trigger copy
    EVENT_HANDLERS['lava-copy']!(new CustomEvent('lava-copy'))
    const { clipboard, caret, selectedBars } = useEditorStore.getState()
    if (!clipboard) return
    const targetMeasure =
      selectedBars.length > 0
        ? Math.max(...selectedBars) + 1
        : (caret?.measureIndex ?? 0) + 1
    const trackId =
      caret?.trackId ?? useScoreDocumentStore.getState().document.tracks[0]?.id
    if (!trackId) return
    applyCommand({
      type: 'pasteSelection',
      targetTrackId: trackId,
      targetMeasureIndex: targetMeasure,
      targetBeat: 0,
      clipboard,
    })
  },

  'lava-open-fretboard': () => {
    useEditorStore.getState().requestInspectorFocus('fretboard')
  },

  'lava-open-duration': () => {
    useEditorStore.getState().requestInspectorFocus('duration')
  },
}

export function registerToolbarBridge(): () => void {
  const entries = Object.entries(EVENT_HANDLERS)
  for (const [event, handler] of entries) {
    window.addEventListener(event, handler as EventListener)
  }
  return () => {
    for (const [event, handler] of entries) {
      window.removeEventListener(event, handler as EventListener)
    }
  }
}
