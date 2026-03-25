import { useLocation } from 'react-router-dom'
import { Bot, ChevronRight } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAudioStore } from '@/stores/audioStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'

const SPACE_LABELS: Record<string, string> = {
  '': 'Home',
  learn: 'Practice',
  jam: 'AI Tools',
  create: 'Create',
  projects: 'My Library',
}

const SUB_LABELS: Record<string, string> = {
  songs: 'Songs',
  jam: 'Session',
  techniques: 'Techniques',
}

export function TopBar() {
  const location = useLocation()
  const toggleAgentPanel = useUIStore((s) => s.toggleAgentPanel)
  const agentPanelOpen = useUIStore((s) => s.agentPanelOpen)
  const bpm = useAudioStore((s) => s.bpm)
  const key = useAudioStore((s) => s.key)

  const segments = location.pathname.split('/').filter(Boolean)
  const space = segments[0]
  const subId = segments[1]

  return (
    <header className="h-12 flex items-center px-4 bg-surface-0 border-b border-border shrink-0 gap-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-1 min-w-0">
        <span className="text-text-primary font-medium">{SPACE_LABELS[space] ?? space}</span>
        {subId && (
          <>
            <ChevronRight size={14} className="text-text-muted" />
            <span className="text-text-secondary truncate">{SUB_LABELS[subId] ?? subId}</span>
          </>
        )}
      </div>

      {/* Transport info — hidden on home page */}
      {space && (
        <div className="flex items-center gap-3 text-xs text-text-muted font-mono">
          <span>{bpm} BPM</span>
          <span>{key}</span>
        </div>
      )}

      {/* Agent toggle — hidden on home page (chat is inline there) */}
      {space && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAgentPanel}
          className={cn(agentPanelOpen && 'text-text-primary bg-surface-3')}
          title="Toggle AI Practice Assistant"
        >
          <Bot size={16} />
        </Button>
      )}
    </header>
  )
}
