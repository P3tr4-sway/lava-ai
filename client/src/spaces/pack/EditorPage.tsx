import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAgentStore } from '@/stores/agentStore'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import { useVersionStore } from '@/stores/versionStore'
import { projectService } from '@/services/projectService'
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { buildScoreDigest, exportScoreDocumentToMusicXml } from '@/lib/scoreDocument'
import { useAudioStore } from '@/stores/audioStore'
import { EditorTitleBar } from './EditorTitleBar'
import { EditorCanvas } from './EditorCanvas'
import { EditorToolbar } from './EditorToolbar'
import { EditorChatPanel } from './EditorChatPanel'
import { PreviewBar } from './PreviewBar'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  useTheme()

  const projectName = useLeadSheetStore((s) => s.projectName)
  const chatCollapsed = useEditorStore((s) => s.chatPanelCollapsed)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const bpm = useAudioStore((s) => s.bpm)
  const playbackRate = useAudioStore((s) => s.playbackRate)
  const scoreDocument = useScoreDocumentStore((s) => s.document)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { totalBars, beatsPerBar } = useMemo(() => {
    return {
      totalBars: scoreDocument.measures.length || 16,
      beatsPerBar: scoreDocument.meter.numerator || 4,
    }
  }, [scoreDocument])

  useEffect(() => {
    if (bpm <= 0) return
    const effectiveBpm = bpm * playbackRate
    const durationSeconds = totalBars * beatsPerBar * (60 / effectiveBpm)
    useAudioStore.getState().setDuration(durationSeconds)
  }, [totalBars, beatsPerBar, bpm, playbackRate])

  // Load project from server when navigating to /pack/:id
  useEffect(() => {
    if (!id) {
      useLeadSheetStore.getState().reset()
      useEditorStore.getState().setSaveStatus('saved')
      return
    }
    projectService.get(id).then((project) => {
      useLeadSheetStore.getState().loadFromProject(project)
      const metadata = project.metadata as Record<string, unknown>
      const scoreSnapshot = metadata.scoreDocument
      const musicXml = typeof metadata.musicXml === 'string' ? metadata.musicXml : null
      if (scoreSnapshot && typeof scoreSnapshot === 'object') {
        useScoreDocumentStore.getState().loadFromSnapshot(scoreSnapshot as typeof scoreDocument)
      } else {
        useScoreDocumentStore.getState().loadFromMusicXml(musicXml)
      }
      const scoreView = typeof metadata.scoreView === 'string' ? metadata.scoreView : 'tab'
      useEditorStore.getState().setViewMode(scoreView === 'lead_sheet' ? 'leadSheet' : scoreView === 'tab' ? 'tab' : scoreView === 'staff' ? 'staff' : 'split')
      useVersionStore.getState().loadFromArrangements()
      useProjectStore.getState().setActiveProject(project)
      useEditorStore.getState().setSaveStatus('saved')
    }).catch((err) => {
      console.error('Failed to load project:', err)
    })
  }, [id])

  // Auto-save with 2 s debounce whenever the sheet is marked unsaved
  useEffect(() => {
    if (!id || saveStatus !== 'unsaved') return
    saveTimerRef.current = setTimeout(async () => {
      useEditorStore.getState().setSaveStatus('saving')
      const s = useLeadSheetStore.getState()
      const scoreState = useScoreDocumentStore.getState()
      const viewMode = useEditorStore.getState().viewMode
      try {
        const updated = await projectService.update(id, {
          name: s.projectName,
          metadata: {
            key: s.key,
            tempo: s.tempo,
            timeSignature: s.timeSignature,
            sections: s.sections,
            arrangements: s.arrangements,
            selectedArrangementId: s.selectedArrangementId,
            scoreView: viewMode === 'split' ? 'tab' : viewMode === 'leadSheet' ? 'lead_sheet' : viewMode,
            pdfUrl: s.pdfUrl,
            musicXml: scoreState.exportCacheXml,
            scoreDocument: scoreState.document,
          },
        })
        useProjectStore.getState().upsertProject(updated)
        useEditorStore.getState().setSaveStatus('saved')
      } catch {
        useEditorStore.getState().setSaveStatus('unsaved')
      }
    }, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [id, saveStatus])

  // Sync editor context to agent store — Trigger 1: musicXml changes (debounced)
  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevDigestRef = useRef<string | null>(null)
  useEffect(() => {
    const sync = () => {
      const selectedBars = useEditorStore.getState().selectedBars
      const selectedNoteIds = useEditorStore.getState().selectedNoteIds
      const cursorNoteId = useEditorStore.getState().cursorNoteId
      const caret = useEditorStore.getState().caret
      const selectionScope = useEditorStore.getState().selectionScope
      const name = useLeadSheetStore.getState().projectName
      const scoreState = useScoreDocumentStore.getState()
      const track = scoreState.document.tracks[0]
      const scoreDigest = buildScoreDigest(scoreState.document)
      useAgentStore.getState().setSpaceContext({
        currentSpace: 'create',
        projectId: id,
        projectName: name,
        editorContext: {
          musicXml: scoreState.exportCacheXml,
          scoreSummary: scoreDigest,
          scoreDigest,
          scoreSnapshot: scoreState.document,
          selectedBars,
          selection: {
            measureRange: selectedBars.length > 0 ? [Math.min(...selectedBars), Math.max(...selectedBars)] : null,
            noteIds: selectedNoteIds,
            cursor: track
              ? {
                  trackId: track.id,
                  noteId: cursorNoteId,
                  measureIndex: caret?.measureIndex ?? selectedBars[0] ?? 0,
                  beat: caret?.beat,
                  string: caret?.string,
                }
              : null,
          },
          tuning: track?.tuning,
          capo: track?.capo,
          selectionScope,
        },
      })
    }

    // Immediate sync on mount / when xml first loads
    sync()
    prevDigestRef.current = useScoreDocumentStore.getState().getDigest()

    const unsub = useScoreDocumentStore.subscribe((state) => {
      const digest = buildScoreDigest(state.document)
      if (digest !== prevDigestRef.current) {
        prevDigestRef.current = digest
        if (contextTimerRef.current) clearTimeout(contextTimerRef.current)
        contextTimerRef.current = setTimeout(sync, 500)
      }
    })
    return () => {
      unsub()
      if (contextTimerRef.current) clearTimeout(contextTimerRef.current)
    }
  }, [id])

  // Sync editor context to agent store — Trigger 2: selectedBars changes (immediate)
  const prevSelectionRef = useRef<{
    selectedBars: number[]
    selectedNoteIds: string[]
    cursorNoteId: string | null
    caretKey: string | null
    selectionScope: string
  }>({
    selectedBars: [],
    selectedNoteIds: [],
    cursorNoteId: null,
    caretKey: null,
    selectionScope: 'note',
  })
  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      const caretKey = state.caret
        ? `${state.caret.trackId}:${state.caret.measureIndex}:${state.caret.beat}:${state.caret.string}`
        : null
      const prevSelection = prevSelectionRef.current
      const selectionChanged =
        prevSelection.selectedBars.join(',') !== state.selectedBars.join(',')
        || prevSelection.selectedNoteIds.join(',') !== state.selectedNoteIds.join(',')
        || prevSelection.cursorNoteId !== state.cursorNoteId
        || prevSelection.caretKey !== caretKey
        || prevSelection.selectionScope !== state.selectionScope

      if (!selectionChanged) return

      prevSelectionRef.current = {
        selectedBars: state.selectedBars,
        selectedNoteIds: state.selectedNoteIds,
        cursorNoteId: state.cursorNoteId,
        caretKey,
        selectionScope: state.selectionScope,
      }

      const prev = useAgentStore.getState().spaceContext
      if (prev.editorContext) {
        useAgentStore.getState().setSpaceContext({
          ...prev,
          editorContext: {
            ...prev.editorContext,
            selectedBars: state.selectedBars,
            selection: {
              ...prev.editorContext.selection,
              measureRange: state.selectedBars.length > 0 ? [Math.min(...state.selectedBars), Math.max(...state.selectedBars)] : null,
              noteIds: state.selectedNoteIds,
              cursor: prev.editorContext.selection?.cursor
                ? {
                    ...prev.editorContext.selection.cursor,
                    noteId: state.cursorNoteId,
                    measureIndex: state.caret?.measureIndex ?? prev.editorContext.selection.cursor.measureIndex,
                    beat: state.caret?.beat,
                    string: state.caret?.string,
                  }
                : null,
            },
            selectionScope: state.selectionScope,
          },
        })
      }
    })
    return unsub
  }, [])

  // Keyboard shortcuts (stores-driven, no callbacks needed)
  useEditorKeyboard()

  // Bar management
  const handleAddBar = useCallback(() => {
    const { selectedBars, caret, selectBar } = useEditorStore.getState()
    const afterIndex = selectedBars.length > 0
      ? Math.max(...selectedBars)
      : caret
        ? caret.measureIndex
        : Math.max(scoreDocument.measures.length - 1, 0)
    useScoreDocumentStore.getState().applyCommand({
      type: 'addMeasureAfter',
      afterIndex: Math.max(afterIndex, 0),
      count: 1,
    })
    selectBar(Math.max(afterIndex + 1, 0))
    useEditorStore.getState().setSaveStatus('unsaved')
  }, [scoreDocument.measures.length])

  const handleDeleteBars = useCallback(() => {
    const { selectedBars, clearSelection } = useEditorStore.getState()
    if (selectedBars.length === 0) return
    useScoreDocumentStore.getState().applyCommand({
      type: 'deleteMeasureRange',
      start: Math.min(...selectedBars),
      end: Math.max(...selectedBars),
    })
    clearSelection()
    useEditorStore.getState().setSaveStatus('unsaved')
  }, [])

  useEffect(() => {
    window.addEventListener('lava-bar-delete', handleDeleteBars)
    return () => window.removeEventListener('lava-bar-delete', handleDeleteBars)
  }, [handleDeleteBars])

  const handleStylePicker = useCallback(() => {
    // TODO: Open playback style picker drawer
  }, [])

  const handleNameChange = useCallback((name: string) => {
    useLeadSheetStore.getState().setProjectName(name)
    useEditorStore.getState().setSaveStatus('unsaved')
  }, [])

  useEffect(() => {
    let isInitial = true
    const unsub = useScoreDocumentStore.subscribe((state) => {
      if (isInitial) {
        isInitial = false
        return
      }
      if (state.exportCacheXml) {
        useEditorStore.getState().setSaveStatus('unsaved')
      }
    })
    return unsub
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col bg-[#f5f4f1]">
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#f7f6f3]">
          <EditorTitleBar packName={projectName || 'Untitled'} onNameChange={handleNameChange} />

          <PreviewBar
            onApply={() => {
              useVersionStore.getState().applyPreview()
            }}
            onDiscard={() => {
              useVersionStore.getState().discardPreview()
            }}
            // TODO: implement CompareView (see spec section 2.3)
            onCompare={() => {}}
          />

          <EditorCanvas className="flex-1" />

          <EditorToolbar
            onAddBar={handleAddBar}
            onDeleteBars={handleDeleteBars}
            onStylePicker={handleStylePicker}
            // TODO: implement CompareView (see spec section 2.3)
            onCompare={() => {}}
            totalBars={totalBars}
            beatsPerBar={beatsPerBar}
            className="z-10"
          />
        </div>

        {!isMobile && <EditorChatPanel className="w-[356px] min-w-[356px] max-w-[356px] bg-white" />}
      </div>

      {isMobile && !chatCollapsed && (
        <div className="h-[40vh] border-t border-border">
          <EditorChatPanel />
        </div>
      )}
    </div>
  )
}
