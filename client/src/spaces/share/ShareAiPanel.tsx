import { useState, useRef, useEffect } from 'react'
import { Send, Bot, X, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'What technique is used in bar 3?',
  'How do I play this chord?',
  'What does "Dropped D" mean?',
  'Explain the time signature',
]

const MOCK_RESPONSES: Record<string, string> = {
  default:
    "I can help you understand this score. Try asking about specific bars, techniques, chords, or any musical concept you see in the sheet.",
  technique:
    "Bar 3 uses **palm muting** (P.M.) combined with a **power chord** shape. Keep your picking hand resting lightly on the strings near the bridge while playing.",
  chord:
    "This chord is a **D5 power chord** — just the root (D) and fifth (A). Position your index finger on the 5th string, 5th fret, and your ring finger on the 4th string, 7th fret.",
  dropped:
    '**Dropped D tuning** means your low E string is tuned down one whole step to D. This gives you a heavier sound and makes power chords playable with a single finger on the lowest three strings.',
  time: "This piece is in **4/4 time** — four beats per bar, with the quarter note getting one beat. The tempo marking of ♩=184 means 184 quarter notes per minute, which is quite fast.",
}

function getMockResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('bar 3') || lower.includes('technique')) return MOCK_RESPONSES.technique
  if (lower.includes('chord')) return MOCK_RESPONSES.chord
  if (lower.includes('dropped')) return MOCK_RESPONSES.dropped
  if (lower.includes('time')) return MOCK_RESPONSES.time
  return MOCK_RESPONSES.default
}

interface ShareAiPanelProps {
  isOpen: boolean
  onClose: () => void
  scoreTitle: string
  className?: string
}

export function ShareAiPanel({ isOpen, onClose, scoreTitle, className }: ShareAiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hi! I'm your AI music tutor. Ask me anything about **${scoreTitle}** — techniques, theory, how to practice specific sections, or any musical concepts.`,
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate response delay
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getMockResponse(text),
      }
      setMessages((m) => [...m, reply])
      setIsTyping(false)
    }, 900)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={cn(
        'flex flex-col w-[320px] shrink-0 bg-surface-0 border-l border-border',
        'animate-slide-in-right',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-accent flex items-center justify-center">
            <Sparkles className="size-3.5 text-surface-0" />
          </div>
          <span className="text-sm font-medium text-text-primary">AI Tutor</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-2', msg.role === 'user' && 'justify-end')}
          >
            {msg.role === 'assistant' && (
              <div className="size-6 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="size-3.5 text-text-secondary" />
              </div>
            )}
            <div
              className={cn(
                'px-3 py-2 rounded-lg text-sm leading-relaxed max-w-[230px]',
                msg.role === 'assistant'
                  ? 'bg-surface-2 text-text-primary'
                  : 'bg-accent text-surface-0',
              )}
              dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>'),
              }}
            />
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2">
            <div className="size-6 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
              <Bot className="size-3.5 text-text-secondary" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-surface-2 flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 rounded-full bg-text-muted animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-col gap-1.5 shrink-0">
          <p className="text-xs text-text-muted mb-0.5">Try asking:</p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); inputRef.current?.focus() }}
              className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary text-left px-2.5 py-1.5 rounded border border-border hover:border-border-hover transition-colors bg-surface-1"
            >
              <ChevronRight className="size-3 shrink-0 text-text-muted" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
        <div className="flex items-end gap-2 bg-surface-1 border border-border rounded-lg px-3 py-2 focus-within:border-border-hover transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this score..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none outline-none min-h-[20px] max-h-[80px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              'size-6 rounded flex items-center justify-center transition-colors shrink-0',
              input.trim()
                ? 'bg-accent text-surface-0 hover:opacity-90'
                : 'text-text-muted cursor-not-allowed',
            )}
          >
            <Send className="size-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1.5 text-center">
          AI responses are for educational purposes
        </p>
      </div>
    </div>
  )
}
