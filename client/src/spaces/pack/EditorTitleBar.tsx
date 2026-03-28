import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'

interface EditorTitleBarProps {
  packName: string
  onNameChange: (name: string) => void
  className?: string
}

export function EditorTitleBar({ packName, onNameChange, className }: EditorTitleBarProps) {
  const navigate = useNavigate()
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(packName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commitName() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== packName) onNameChange(trimmed)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'flex h-[var(--editor-titlebar-height)] items-center gap-3 border-b border-border bg-surface-0 px-4',
        className,
      )}
    >
      <button
        onClick={() => navigate(-1)}
        className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') { setDraft(packName); setEditing(false) }
          }}
          className="h-7 rounded border border-border bg-surface-1 px-2 text-sm text-text-primary outline-none focus:border-border-hover"
        />
      ) : (
        <button
          onClick={() => { setDraft(packName); setEditing(true) }}
          className="text-sm font-semibold text-text-primary hover:text-accent"
        >
          {packName}
        </button>
      )}

      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        {saveStatus === 'saved' && (
          <>
            <span className="size-1.5 rounded-full bg-success" />
            Saved
          </>
        )}
        {saveStatus === 'saving' && (
          <>
            <span className="size-1.5 animate-pulse rounded-full bg-warning" />
            Saving...
          </>
        )}
        {saveStatus === 'unsaved' && (
          <>
            <span className="size-1.5 rounded-full bg-text-muted" />
            Unsaved
          </>
        )}
      </div>

      <div className="flex-1" />
    </div>
  )
}
