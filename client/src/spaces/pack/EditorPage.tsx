import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Version } from '@lava/shared'
import { Loader2 } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAgentStore } from '@/stores/agentStore'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import { useVersionStore } from '@/stores/versionStore'
import { projectService } from '@/services/projectService'
import { useEditorCommandBridge } from '@/hooks/useEditorCommandBridge'
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePlaybackStateBridge } from '@/hooks/usePlaybackStateBridge'
import { useTheme } from '@/hooks/useTheme'
import { buildScoreDigest, cloneScoreDocument, exportScoreDocumentToMusicXml } from '@/lib/scoreDocument'
import { useAudioStore } from '@/stores/audioStore'
import { registerToolbarBridge } from '@/spaces/pack/editor-core/toolbarBridge'
import { EditorTitleBar } from './EditorTitleBar'
import { EditorCanvas } from './EditorCanvas'
import { EditorToolbar } from './EditorToolbar'
import { EditorChatPanel } from './EditorChatPanel'
import { PreviewBar } from './PreviewBar'
import { PackReadyBar } from './PackReadyBar'
import { ExportPdfDialog } from './ExportPdfDialog'
import { NEW_PACK_TUNINGS } from './newPack'

type ProjectLoadState = 'loading' | 'ready' | 'error'
type RenderStatus = 'idle' | 'running' | 'error'

const PACK_RENDER_STAGES: Record<string, string[]> = {
  audio: ['Read audio', 'Prepare pack', 'Finish pack'],
  youtube: ['Read link', 'Prepare pack', 'Finish pack'],
  'pdf-image': ['Generate score', 'Prepare pack', 'Finish pack'],
  musicxml: ['Prepare pack', 'Finish pack'],
}

function extractVersionsFromSnapshots(snapshots: Array<{ snapshot: Record<string, unknown>; createdAt: number }>): Version[] {
  return snapshots.flatMap((entry) => {
    const snapshot = entry.snapshot
    if (
      typeof snapshot.id !== 'string'
      || typeof snapshot.name !== 'string'
      || typeof snapshot.source !== 'string'
      || typeof snapshot.musicXml !== 'string'
    ) {
      return []
    }

    return [{
      id: snapshot.id,
      name: snapshot.name,
      source: snapshot.source as Version['source'],
      arrangementId: typeof snapshot.arrangementId === 'string' ? snapshot.arrangementId as Version['arrangementId'] : undefined,
      musicXml: snapshot.musicXml,
      scoreSnapshot: typeof snapshot.scoreSnapshot === 'object' && snapshot.scoreSnapshot !== null ? snapshot.scoreSnapshot as Version['scoreSnapshot'] : undefined,
      parentVersionId: typeof snapshot.parentVersionId === 'string' ? snapshot.parentVersionId : undefined,
      prompt: typeof snapshot.prompt === 'string' ? snapshot.prompt : undefined,
      createdAt: typeof snapshot.createdAt === 'number' ? snapshot.createdAt : entry.createdAt,
    }]
  })
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const { toast } = useToast()
  useTheme()

  const activeProject = useProjectStore((s) => s.activeProject)
  const projectName = useLeadSheetStore((s) => s.projectName)
  const sections = useLeadSheetStore((s) => s.sections)
  const chatCollapsed = useEditorStore((s) => s.chatPanelCollapsed)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const viewMode = useEditorStore((s) => s.viewMode)
  const bpm = useAudioStore((s) => s.bpm)
  const playbackRate = useAudioStore((s) => s.playbackRate)
  const scoreDocument = useScoreDocumentStore((s) => s.document)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [projectLoadState, setProjectLoadState] = useState<ProjectLoadState>('loading')
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [showReadyBar, setShowReadyBar] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [renderStatus, setRenderStatus] = useState<RenderStatus>('idle')
  const [renderStageIndex, setRenderStageIndex] = useState(0)
  const [switchingVersionId, setSwitchingVersionId] = useState<string | null>(null)

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

  const readyDismissKey = id ? `lava-pack-ready-dismissed:${id}` : null

  const tuningLabel = useMemo(() => {
    const currentTuning = scoreDocument.tracks[0]?.tuning ?? []
    return NEW_PACK_TUNINGS.find((entry) =>
      entry.midi.length === currentTuning.length && entry.midi.every((value, index) => value === currentTuning[index]),
    )?.label ?? 'Custom tuning'
  }, [scoreDocument.tracks])

  const exportLayout = useMemo<'tab' | 'staff' | 'split'>(() => {
    if (viewMode === 'leadSheet' || viewMode === 'staff') return 'staff'
    if (viewMode === 'split') return 'split'
    return 'tab'
  }, [viewMode])

  const renderSource = searchParams.get('source') ?? 'pdf-image'
  const renderStages = useMemo(
    () => PACK_RENDER_STAGES[renderSource] ?? PACK_RENDER_STAGES['pdf-image'],
    [renderSource],
  )
  const isRendering = searchParams.get('rendering') === '1'
  const shouldRenderFail = searchParams.get('renderFail') === '1'
  const isVersionSwitching = switchingVersionId !== null
  const renderSourceLabel = useMemo(() => {
    const metadata = activeProject?.metadata as Record<string, unknown> | undefined
    return typeof metadata?.sourceLabel === 'string' ? metadata.sourceLabel : projectName || 'Untitled'
  }, [activeProject?.metadata, projectName])

  // Load project from server when navigating to /pack/:id
  useEffect(() => {
    let cancelled = false

    if (!id) {
      useLeadSheetStore.getState().reset()
      useVersionStore.getState().reset()
      useEditorStore.getState().setSaveStatus('saved')
      setProjectLoadState('ready')
      setProjectLoadError(null)
      return
    }
    setProjectLoadState('loading')
    setProjectLoadError(null)

    void (async () => {
      try {
        const [project, persistedVersions] = await Promise.all([
          projectService.get(id),
          projectService.listVersions(id).catch(() => []),
        ])
        if (cancelled) return

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
        useEditorStore.getState().setViewMode(scoreView === 'lead_sheet' ? 'leadSheet' : scoreView === 'tab' ? 'tab' : scoreView === 'staff' ? 'staff' : 'tab')

        const hydratedVersions = extractVersionsFromSnapshots(persistedVersions)
        if (hydratedVersions.length > 0) {
          useVersionStore.getState().hydrateVersions(hydratedVersions)
        } else {
          useVersionStore.getState().loadFromArrangements()
        }

        useProjectStore.getState().setActiveProject(project)
        useEditorStore.getState().setSaveStatus('saved')
        setProjectLoadState('ready')
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load project:', err)
        setProjectLoadError('Could not load this pack. Please try again or go back to the library.')
        setProjectLoadState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, reloadCount])

  useEffect(() => {
    const entry = searchParams.get('entry')
    if (entry === 'edit') {
      useEditorStore.getState().setEditorMode('fineEdit')
      return
    }
    if (entry === 'play' || entry === 'practice' || entry === null) {
      useEditorStore.getState().setEditorMode('transform')
      return
    }
    useEditorStore.getState().setEditorMode('transform')
  }, [searchParams])

  useEffect(() => {
    if (!id || projectLoadState !== 'ready') return
    const shouldShow = searchParams.get('ready') === '1' && readyDismissKey
      ? window.localStorage.getItem(readyDismissKey) !== '1'
      : false
    setShowReadyBar(shouldShow && !isRendering)
  }, [id, isRendering, projectLoadState, readyDismissKey, searchParams])

  useEffect(() => {
    if (!isRendering || projectLoadState !== 'ready') {
      setRenderStatus('idle')
      setRenderStageIndex(0)
      return
    }

    setRenderStatus('running')
    setRenderStageIndex(0)

    const timer = window.setInterval(() => {
      setRenderStageIndex((current) => {
        if (current < renderStages.length - 1) return current + 1

        window.clearInterval(timer)

        if (shouldRenderFail) {
          setRenderStatus('error')
          toast('Could not finish the pack.', 'error')
          return current
        }

        setRenderStatus('idle')
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('rendering')
        nextParams.delete('source')
        nextParams.delete('renderFail')
        setSearchParams(nextParams, { replace: true })
        return current
      })
    }, 1100)

    return () => window.clearInterval(timer)
  }, [isRendering, projectLoadState, renderStages.length, searchParams, setSearchParams, shouldRenderFail, toast])

  // Sync editor context to agent store — Trigger 1: musicXml changes (debounced)
  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevDigestRef = useRef<string | null>(null)
  useEffect(() => {
    const sync = () => {
      const selectedBars = useEditorStore.getState().selectedBars
      const selectedNoteIds = useEditorStore.getState().selectedNoteIds
      const cursorNoteId = useEditorStore.getState().cursorNoteId
      const caret = useEditorStore.getState().caret
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
  }>({
    selectedBars: [],
    selectedNoteIds: [],
    cursorNoteId: null,
    caretKey: null,
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

      if (!selectionChanged) return

      prevSelectionRef.current = {
        selectedBars: state.selectedBars,
        selectedNoteIds: state.selectedNoteIds,
        cursorNoteId: state.cursorNoteId,
        caretKey,
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
          },
        })
      }
    })
    return unsub
  }, [])

  // Keyboard shortcuts (stores-driven, no callbacks needed)
  useEditorKeyboard()
  useEditorCommandBridge()
  usePlaybackStateBridge()

  // Bar management
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

  const handleNameChange = useCallback((name: string) => {
    useLeadSheetStore.getState().setProjectName(name)
    useEditorStore.getState().setSaveStatus('unsaved')
  }, [])

  const persistEditorState = useCallback(async (options?: { showToast?: boolean }) => {
    if (!id) return

    const s = useLeadSheetStore.getState()
    const scoreState = useScoreDocumentStore.getState()
    const currentViewMode = useEditorStore.getState().viewMode

    const updated = await projectService.update(id, {
      name: s.projectName,
      metadata: {
        key: s.key,
        tempo: s.tempo,
        timeSignature: s.timeSignature,
        sections: s.sections,
        arrangements: s.arrangements,
        selectedArrangementId: s.selectedArrangementId,
        scoreView: currentViewMode === 'leadSheet' ? 'lead_sheet' : currentViewMode,
        pdfUrl: s.pdfUrl,
        musicXml: scoreState.exportCacheXml,
        scoreDocument: scoreState.document,
      },
    })

    useProjectStore.getState().upsertProject(updated)
    useEditorStore.getState().setSaveStatus('saved')

    if (options?.showToast) {
      toast('Saved.', 'success')
    }
  }, [id, toast])

  const handleSaveNow = useCallback(async () => {
    if (!id || saveStatus === 'saving') return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    useEditorStore.getState().setSaveStatus('saving')
    try {
      await persistEditorState({ showToast: true })
    } catch (err) {
      console.error('[EditorPage] manual save failed', err)
      useEditorStore.getState().setSaveStatus('unsaved')
      toast('Could not save.', 'error')
    }
  }, [id, persistEditorState, saveStatus, toast])

  const handleSelectVersion = useCallback(async (nextVersionId: string) => {
    if (!id || isVersionSwitching) return

    const versionStore = useVersionStore.getState()
    const currentVersionId = versionStore.activeVersionId
    if (nextVersionId === currentVersionId) return

    try {
      setSwitchingVersionId(nextVersionId)

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      useEditorStore.getState().setSaveStatus('saving')

      const currentSnapshot = cloneScoreDocument(useScoreDocumentStore.getState().document)
      const currentMusicXml =
        useScoreDocumentStore.getState().exportCacheXml || exportScoreDocumentToMusicXml(currentSnapshot)

      useVersionStore.getState().updateVersion(currentVersionId, {
        scoreSnapshot: currentSnapshot,
        musicXml: currentMusicXml,
      })

      await persistEditorState()
      await new Promise((resolve) => window.setTimeout(resolve, 520))

      useVersionStore.getState().setActiveVersion(nextVersionId)
      useEditorStore.getState().setSaveStatus('saved')
    } catch (err) {
      console.error('[EditorPage] version switch failed', err)
      useEditorStore.getState().setSaveStatus('unsaved')
      toast('Could not switch version.', 'error')
    } finally {
      setSwitchingVersionId(null)
    }
  }, [id, isVersionSwitching, persistEditorState, toast])

  // Auto-save with 2 s debounce whenever the sheet is marked unsaved
  useEffect(() => {
    if (!id || saveStatus !== 'unsaved') return
    saveTimerRef.current = setTimeout(async () => {
      useEditorStore.getState().setSaveStatus('saving')
      try {
        await persistEditorState()
      } catch (err) {
        console.error('[EditorPage] auto-save failed', err)
        useEditorStore.getState().setSaveStatus('unsaved')
      }
    }, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [id, persistEditorState, saveStatus])

  const handleCompare = useCallback(() => {
    toast('Compare view is still being connected.')
  }, [toast])

  const dismissReadyBar = useCallback(() => {
    if (readyDismissKey) window.localStorage.setItem(readyDismissKey, '1')
    setShowReadyBar(false)
    if (searchParams.get('ready') === '1') {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('ready')
      setSearchParams(nextParams, { replace: true })
    }
  }, [readyDismissKey, searchParams, setSearchParams])

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

  useEffect(() => {
    const handleAudioError = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>
      toast(customEvent.detail?.message ?? 'Playback could not start.', 'error')
    }

    window.addEventListener('lava-audio-error', handleAudioError as EventListener)
    return () => window.removeEventListener('lava-audio-error', handleAudioError as EventListener)
  }, [toast])

  useEffect(() => {
    const cleanup = registerToolbarBridge()
    return cleanup
  }, [])

  if (projectLoadState === 'loading') {
    return (
      <div className="flex h-screen w-screen flex-col bg-surface-1">
        <div className="flex flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
            <div className="h-14 w-72 animate-pulse rounded-2xl bg-surface-2" />
            <div className="flex-1 animate-pulse rounded-[32px] border border-border bg-surface-0" />
            <div className="h-24 animate-pulse rounded-[28px] bg-surface-0" />
          </div>
          {!isMobile && <div className="hidden w-[356px] animate-pulse border-l border-border bg-surface-0 lg:block" />}
        </div>
      </div>
    )
  }

  if (projectLoadState === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-1 px-6">
        <div className="w-full max-w-md rounded-[28px] border border-border bg-surface-0 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-text-primary">Pack unavailable</h1>
          <p className="mt-2 text-sm text-text-secondary">{projectLoadError}</p>
          <div className="mt-6 flex gap-3">
            <Button type="button" onClick={() => setReloadCount((count) => count + 1)}>
              Retry
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/')}>
              Back home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-surface-1">
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1 flex-col bg-surface-1">
          <EditorTitleBar
            packName={projectName || 'Untitled'}
            onNameChange={handleNameChange}
            onSave={handleSaveNow}
            onExportPdf={() => setExportDialogOpen(true)}
            onSelectVersion={handleSelectVersion}
            versionSwitching={isVersionSwitching}
            loadingVersionId={switchingVersionId}
          />

          {showReadyBar ? (
            <PackReadyBar
              onClose={dismissReadyBar}
            />
          ) : null}

          <PreviewBar
            onApply={() => {
              useVersionStore.getState().applyPreview()
            }}
            onDiscard={() => {
              useVersionStore.getState().discardPreview()
            }}
            onCompare={handleCompare}
          />

          <div className="relative flex min-h-0 flex-1">
            <EditorCanvas className={cn('flex-1 transition-opacity duration-200', (isRendering || isVersionSwitching) && 'pointer-events-none opacity-60')} />

            <EditorToolbar
              totalBars={totalBars}
              beatsPerBar={beatsPerBar}
              className="z-20"
            />

            {isRendering || isVersionSwitching ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/8 backdrop-blur-sm">
                <div className="w-full max-w-[720px] px-8">
                  <div className="rounded-[28px] border border-border/80 bg-surface-0/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center gap-3">
                      <Loader2 className="size-5 animate-spin text-text-primary" />
                      <span className="text-base font-medium text-text-primary">
                        {isVersionSwitching ? 'Switching version...' : 'Loading score...'}
                      </span>
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="h-4 w-40 animate-pulse rounded-full bg-surface-2" />
                      <div className="h-24 animate-pulse rounded-[20px] bg-surface-1" />
                      <div className="grid grid-cols-3 gap-3">
                        <div className="h-16 animate-pulse rounded-[18px] bg-surface-1" />
                        <div className="h-16 animate-pulse rounded-[18px] bg-surface-1" />
                        <div className="h-16 animate-pulse rounded-[18px] bg-surface-1" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {!isMobile && <EditorChatPanel className="min-w-[360px] bg-surface-0" />}
      </div>

      {isMobile && !chatCollapsed && (
        <div className="h-[40vh] border-t border-border">
          <EditorChatPanel />
        </div>
      )}

      <ExportPdfDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        packName={projectName || 'Untitled'}
        defaultLayout={exportLayout}
        keyValue={scoreDocument.keySignature.key}
        tempo={scoreDocument.tempo}
        timeSignature={`${scoreDocument.meter.numerator}/${scoreDocument.meter.denominator}`}
        tuningLabel={tuningLabel}
        capo={scoreDocument.tracks[0]?.capo ?? 0}
        sections={sections.map((section) => ({
          label: section.label,
          bars: section.measures.length,
        }))}
      />
    </div>
  )
}
