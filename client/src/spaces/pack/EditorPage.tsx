import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAgentStore } from '@/stores/agentStore'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { projectService } from '@/services/projectService'
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { addBars, deleteBars, parseXml, getMeasures } from '@/lib/musicXmlEngine'
import { useAudioStore } from '@/stores/audioStore'
import { EditorTitleBar } from './EditorTitleBar'
import { EditorCanvas } from './EditorCanvas'
import { EditorToolbar } from './EditorToolbar'
import { EditorChatPanel } from './EditorChatPanel'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  useTheme()

  const projectName = useLeadSheetStore((s) => s.projectName)
  const musicXml = useLeadSheetStore((s) => s.musicXml)
  const chatCollapsed = useEditorStore((s) => s.chatPanelCollapsed)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const bpm = useAudioStore((s) => s.bpm)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { totalBars, beatsPerBar } = useMemo(() => {
    if (!musicXml) return { totalBars: 16, beatsPerBar: 4 }
    try {
      const doc = parseXml(musicXml)
      const bars = getMeasures(doc).length
      const beats = parseInt(doc.querySelector('time > beats')?.textContent ?? '4', 10)
      return {
        totalBars: bars || 16,
        beatsPerBar: isNaN(beats) ? 4 : beats,
      }
    } catch {
      return { totalBars: 16, beatsPerBar: 4 }
    }
  }, [musicXml])

  useEffect(() => {
    if (bpm <= 0) return
    const durationSeconds = totalBars * beatsPerBar * (60 / bpm)
    useAudioStore.getState().setDuration(durationSeconds)
  }, [totalBars, beatsPerBar, bpm])

  // Load project from server when navigating to /pack/:id
  useEffect(() => {
    if (!id) {
      useLeadSheetStore.getState().reset()
      useEditorStore.getState().setSaveStatus('saved')
      return
    }
    projectService.get(id).then((project) => {
      useLeadSheetStore.getState().loadFromProject(project)
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
            scoreView: s.scoreView,
            pdfUrl: s.pdfUrl,
            musicXml: s.musicXml,
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

  // Set agent space context
  useEffect(() => {
    useAgentStore.getState().setSpaceContext({
      currentSpace: 'create',
      projectId: id,
      projectName,
    })
  }, [id, projectName])

  // Keyboard shortcuts (stores-driven, no callbacks needed)
  useEditorKeyboard()

  // Bar management
  const handleAddBar = useCallback(() => {
    const xml = useLeadSheetStore.getState().musicXml
    if (!xml) return
    const { selectedBars, pushUndo } = useEditorStore.getState()
    const afterIndex = selectedBars.length > 0 ? Math.max(...selectedBars) : -1
    try {
      const newXml = addBars(xml, Math.max(afterIndex, 0), 1)
      pushUndo(xml)
      useLeadSheetStore.getState().setMusicXml(newXml)
      useEditorStore.getState().setSaveStatus('unsaved')
    } catch (err) {
      console.error('[handleAddBar] addBars failed:', err)
    }
  }, [])

  const handleDeleteBars = useCallback(() => {
    const xml = useLeadSheetStore.getState().musicXml
    const { selectedBars, clearSelection, pushUndo } = useEditorStore.getState()
    if (!xml || selectedBars.length === 0) return
    try {
      const newXml = deleteBars(xml, selectedBars)
      pushUndo(xml)
      useLeadSheetStore.getState().setMusicXml(newXml)
      clearSelection()
      useEditorStore.getState().setSaveStatus('unsaved')
    } catch (err) {
      console.error('[handleDeleteBars] deleteBars failed:', err)
    }
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

  return (
    <div className="flex h-screen w-screen flex-col bg-surface-0">
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor area */}
        <div className="relative flex flex-1 flex-col">
          <EditorTitleBar packName={projectName || 'Untitled'} onNameChange={handleNameChange} />

          <EditorCanvas className="flex-1" />

          {/* Unified floating toolbar with embedded playback controls */}
          <EditorToolbar
            onAddBar={handleAddBar}
            onDeleteBars={handleDeleteBars}
            onStylePicker={handleStylePicker}
            onCompare={() => {}}
            totalBars={totalBars}
            beatsPerBar={beatsPerBar}
            className="z-20"
          />
        </div>

        {/* Right: Chat panel (desktop only) */}
        {!isMobile && <EditorChatPanel />}
      </div>

      {/* Mobile: Chat as bottom sheet */}
      {isMobile && !chatCollapsed && (
        <div className="h-[40vh] border-t border-border">
          <EditorChatPanel />
        </div>
      )}
    </div>
  )
}
