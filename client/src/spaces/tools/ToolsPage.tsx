import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { Wrench, Music, Sliders, FileAudio, Mic } from 'lucide-react'
import { Card } from '@/components/ui/Card'

const TOOLS = [
  {
    id: 'transcribe',
    icon: FileAudio,
    title: 'Transcriber',
    description: 'Convert any audio to sheet music or MIDI',
  },
  {
    id: 'tone',
    icon: Music,
    title: 'Tone Generator',
    description: 'Generate tones, chords, and scales',
  },
  {
    id: 'effects',
    icon: Sliders,
    title: 'Effects Chain',
    description: 'Apply real-time audio effects',
  },
  {
    id: 'recorder',
    icon: Mic,
    title: 'Quick Recorder',
    description: 'Record and export audio snippets',
  },
]

export function ToolsPage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'tools', projectId: id })
  }, [id, setSpaceContext])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Wrench size={20} className="text-text-secondary" />
          <h1 className="text-xl font-semibold">Tools</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Standalone AI music tools — no project needed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TOOLS.map(({ id: toolId, icon: Icon, title, description }) => (
          <Card
            key={toolId}
            hoverable
            className="flex items-start gap-4"
          >
            <div className="w-9 h-9 rounded bg-surface-3 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-text-muted mt-0.5">{description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
