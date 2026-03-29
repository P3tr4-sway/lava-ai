import { useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAgentStore } from '@/stores/agentStore'
import { useEditorStore } from '@/stores/editorStore'
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { EditorTitleBar } from './EditorTitleBar'
import { EditorCanvas } from './EditorCanvas'
import { EditorToolbar } from './EditorToolbar'
import { EditorChatPanel } from './EditorChatPanel'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  useTheme()

  const projectName = useLeadSheetStore((s) => s.projectName)
  const chatCollapsed = useEditorStore((s) => s.chatPanelCollapsed)

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
    // TODO: Add a bar to the MusicXML in leadSheetStore
  }, [])

  const handleDeleteBars = useCallback(() => {
    const selected = useEditorStore.getState().selectedBars
    if (selected.length === 0) return
    // TODO: Delete selected bars from MusicXML in leadSheetStore
    useEditorStore.getState().clearSelection()
  }, [])

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
            totalBars={16}
            beatsPerBar={4}
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
