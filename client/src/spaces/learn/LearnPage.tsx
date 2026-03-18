import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { BookOpen, Upload, Music, Play } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function LearnPage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn', projectId: id })
  }, [id, setSpaceContext])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={20} className="text-text-secondary" />
          <h1 className="text-xl font-semibold">Learn</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Upload any audio — LAVA AI transcribes it to sheet music so you can learn by playing
          along.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StepCard
          step={1}
          icon={<Upload size={20} />}
          title="Upload Audio"
          description="Drop an MP3, WAV, or any audio file"
        />
        <StepCard
          step={2}
          icon={<Music size={20} />}
          title="AI Transcription"
          description="LAVA converts audio to sheet music"
        />
        <StepCard
          step={3}
          icon={<Play size={20} />}
          title="Play Along"
          description="Follow the score with real-time sync"
        />
      </div>

      <UploadZone />
    </div>
  )
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-text-muted">{String(step).padStart(2, '0')}</span>
        <span className="text-text-secondary">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-text-muted mt-1">{description}</p>
      </div>
    </Card>
  )
}

function UploadZone() {
  return (
    <div className="border border-dashed border-border hover:border-border-hover rounded-lg p-12 flex flex-col items-center gap-4 text-center transition-colors cursor-pointer group">
      <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center group-hover:bg-surface-4 transition-colors">
        <Upload size={20} className="text-text-secondary" />
      </div>
      <div>
        <p className="text-sm font-medium">Drop audio here</p>
        <p className="text-xs text-text-muted mt-1">MP3, WAV, FLAC, M4A — up to 50 MB</p>
      </div>
      <Button variant="outline" size="sm">
        Browse Files
      </Button>
    </div>
  )
}
