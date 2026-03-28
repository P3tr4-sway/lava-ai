import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip, X } from 'lucide-react'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/components/ui/utils'

const STYLE_CHIPS = ['Simplified', 'Fingerpicking'] as const

type SubmitPhase = 'idle' | 'analyzing' | 'arranging' | 'building'

const PHASE_LABELS: Record<SubmitPhase, string> = {
  idle: '',
  analyzing: 'Analyzing your song...',
  arranging: 'Creating arrangement...',
  building: 'Building practice pack...',
}

export function HomePage() {
  const navigate = useNavigate()
  const chatRef = useRef<ChatInputRef>(null)
  const projects = useProjectStore((s) => s.projects)
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  const handleChipClick = (style: string) => {
    chatRef.current?.setValue(`Convert to ${style.toLowerCase()} arrangement`)
    chatRef.current?.focus()
  }

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*,.pdf,.musicxml,.mxl,.xml'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) setAttachedFile(file)
    }
    input.click()
  }

  const handleSend = useCallback(async (message: string) => {
    if (!message.trim() && !attachedFile) return

    // Simulated loading phases — will be wired to real agent in later iteration
    setPhase('analyzing')
    setTimeout(() => setPhase('arranging'), 1500)
    setTimeout(() => setPhase('building'), 3000)
    setTimeout(() => {
      setPhase('idle')
      // TODO: navigate to real pack ID from agent response
      navigate('/pack/demo')
    }, 4500)
  }, [attachedFile, navigate])

  const recentPacks = projects.slice(0, 6)

  if (phase !== 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="size-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-lg text-text-secondary animate-pulse">
          {PHASE_LABELS[phase]}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pt-[22vh] pb-12 flex flex-col gap-10">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-3">
        <h1 className="text-[48px] font-bold leading-none tracking-tight text-text-primary">
          Practice any song your way
        </h1>
        <p className="text-base text-text-secondary">
          Upload a song, get a practice pack in seconds
        </p>
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-3">
        {/* File chip */}
        {attachedFile && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 rounded-lg w-fit text-sm text-text-primary">
            <Paperclip className="size-3.5 text-text-secondary" />
            <span className="truncate max-w-[200px]">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="text-text-muted hover:text-text-primary">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Chat input with attachment */}
        <div className="relative">
          <ChatInput
            ref={chatRef}
            onSend={handleSend}
            placeholder="Describe what you want to practice..."
            density="roomy"
            onAttachClick={handleFileSelect}
          />
        </div>

        {/* Style chips */}
        <div className="flex items-center gap-2 justify-center">
          {STYLE_CHIPS.map((style) => (
            <button
              key={style}
              onClick={() => handleChipClick(style)}
              className={cn(
                'px-4 py-2 rounded-lg border border-border text-sm text-text-secondary',
                'hover:bg-surface-1 hover:text-text-primary transition-colors',
              )}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Recent packs */}
      {recentPacks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text-primary">Recent</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentPacks.map((pack) => (
              <button
                key={pack.id}
                onClick={() => navigate(`/pack/${pack.id}`)}
                className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-surface-0 hover:bg-surface-1 transition-colors min-w-[180px] text-left"
              >
                <span className="text-sm font-medium text-text-primary truncate">
                  {pack.name}
                </span>
                <span className="text-xs text-text-muted">
                  {new Date(pack.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentPacks.length === 0 && (
        <p className="text-center text-sm text-text-muted">
          Your practice packs will appear here.
        </p>
      )}
    </div>
  )
}
