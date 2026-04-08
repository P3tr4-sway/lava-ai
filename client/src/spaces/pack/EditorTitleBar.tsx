import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Share2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { Button } from '@/components/ui/Button'
import { VersionPicker } from './VersionPicker'

interface EditorTitleBarProps {
  packName: string
  onNameChange: (name: string) => void
  onSave?: () => void
  onExportPdf?: () => void
  onSelectVersion?: (id: string) => void | Promise<void>
  versionSwitching?: boolean
  loadingVersionId?: string | null
  className?: string
}

export function EditorTitleBar({
  packName,
  onNameChange,
  onSave,
  onExportPdf,
  onSelectVersion,
  versionSwitching = false,
  loadingVersionId = null,
  className,
}: EditorTitleBarProps) {
  const navigate = useNavigate()
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(packName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!editing) setDraft(packName)
  }, [packName, editing])

  function commitName() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== packName) onNameChange(trimmed)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'flex h-[var(--editor-titlebar-height)] items-center gap-3 bg-transparent px-5',
        className,
      )}
    >
      <button
        onClick={() => navigate('/')}
        className="flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-2 hover:text-text-primary"
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
          className="h-8 rounded-xl border border-border bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-border-hover"
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
            <span className="size-1.5 rounded-full bg-border" />
            Unsaved
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <VersionPicker
          onSelectVersion={onSelectVersion}
          disabled={versionSwitching}
          loadingVersionId={loadingVersionId}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onSave?.()}
          disabled={saveStatus === 'saving' || versionSwitching}
          title={saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
          aria-label={saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        >
          <Save className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onExportPdf?.()}
          disabled={versionSwitching}
          title="Export PDF"
          aria-label="Export PDF"
        >
          <Share2 className="size-4" />
        </Button>
      </div>

    </div>
  )
}
