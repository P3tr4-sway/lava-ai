import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { Layers, Plus, Play, Square } from 'lucide-react'
import { SpaceAgentInput } from '@/components/agent/SpaceAgentInput'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ModuleDrawer } from '@/components/ModuleDrawer'
import { useAudioStore } from '@/stores/audioStore'

export function CreatePage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const playbackState = useAudioStore((s) => s.playbackState)
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)
  const bpm = useAudioStore((s) => s.bpm)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'create', projectId: id })
  }, [id, setSpaceContext])

  const isPlaying = playbackState === 'playing'

  return (
    <div className="flex flex-col h-full">
      {/* DAW toolbar */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 bg-surface-0 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPlaybackState(isPlaying ? 'stopped' : 'playing')}
          >
            {isPlaying ? <Square size={12} /> : <Play size={12} />}
          </Button>
        </div>
        <span className="text-xs font-mono text-text-muted">{bpm} BPM</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="hidden sm:inline-flex">
          <Plus size={12} /> Add Track
        </Button>
        <Button variant="outline" size="icon-sm" className="sm:hidden">
          <Plus size={14} />
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:inline-flex">
          Export
        </Button>
        <ModuleDrawer moduleSpace="create" label="My Create" />
      </div>

      {/* Timeline area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track headers */}
        <div className="w-48 shrink-0 border-r border-border bg-surface-0 hidden md:flex flex-col">
          <div className="h-8 border-b border-border flex items-center px-3">
            <span className="text-xs text-text-muted">Tracks</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
            <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center">
              <Layers size={16} className="text-text-muted" />
            </div>
            <p className="text-xs text-text-muted text-center">No tracks yet</p>
            <Button variant="ghost" size="sm">
              <Plus size={12} /> Add Track
            </Button>
          </div>
        </div>

        {/* Timeline canvas */}
        <div className="flex-1 bg-surface-1 overflow-auto">
          <div className="h-8 border-b border-border bg-surface-0 sticky top-0 z-10" />
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <Card className="max-w-sm text-center">
              <Layers size={32} className="text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Start composing</p>
              <p className="text-xs text-text-muted mb-4">
                Add tracks or ask LAVA AI to generate musical ideas
              </p>
              <SpaceAgentInput placeholder="Describe what you want to create, or ask anything..." />
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
