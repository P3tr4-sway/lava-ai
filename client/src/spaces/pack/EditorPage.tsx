import { useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAudioStore } from '@/stores/audioStore'
import { useAgentStore } from '@/stores/agentStore'
import { useDawPanelStore } from '@/stores/dawPanelStore'
import { useEditorStore } from '@/stores/editorStore'
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { EditorTitleBar } from './EditorTitleBar'
import { EditorCanvas } from './EditorCanvas'
import { EditorToolbar } from './EditorToolbar'
import { EditorChatPanel } from './EditorChatPanel'
import { CompactDawStrip } from './CompactDawStrip'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  useTheme()

  const projectName = useLeadSheetStore((s) => s.projectName)
  const tracks = useDawPanelStore((s) => s.tracks)
  const updateTrack = useDawPanelStore((s) => s.updateTrack)
  const addTrack = useDawPanelStore((s) => s.addTrack)
  const removeTrack = useDawPanelStore((s) => s.removeTrack)
  const chatCollapsed = useEditorStore((s) => s.chatPanelCollapsed)

  // Set agent space context
  useEffect(() => {
    useAgentStore.getState().setSpaceContext({
      currentSpace: 'create',
      projectId: id,
      projectName,
    })
  }, [id, projectName])

  // Re-seed DAW tracks whenever the store is empty (also covers mount)
  useEffect(() => {
    if (tracks.length === 0) {
      useDawPanelStore.getState().addTrack()
    }
  }, [tracks.length])

  // Keyboard shortcuts (stores-driven, no callbacks needed)
  useEditorKeyboard()

  // Playback toggle
  const handlePlayPause = useCallback(() => {
    const store = useAudioStore.getState()
    if (store.playbackState === 'playing') {
      store.setPlaybackState('paused')
    } else {
      store.setPlaybackState('playing')
    }
  }, [])

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

          <CompactDawStrip
            dawProps={{
              tracks,
              onUpdateTrack: updateTrack,
              onAddTrack: addTrack,
              onRemoveTrack: removeTrack,
              showRecordButton: true,
              totalBars: 16,
              beatsPerBar: 4,
            }}
          />

          {/* Floating toolbar — absolute positioned within editor area (z-20 to float above canvas) */}
          <EditorToolbar
            onPlayPause={handlePlayPause}
            onAddBar={handleAddBar}
            onDeleteBars={handleDeleteBars}
            onStylePicker={handleStylePicker}
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
