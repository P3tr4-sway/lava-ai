import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Save, Share2, SlidersHorizontal } from 'lucide-react'
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
  settingsContent?: ReactNode
  zoom?: number
  onZoomChange?: (zoom: number) => void
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
  settingsContent,
  zoom = 100,
  onZoomChange,
  className,
}: EditorTitleBarProps) {
  const navigate = useNavigate()
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(packName)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!editing) setDraft(packName)
  }, [packName, editing])

  useEffect(() => {
    if (!settingsOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [settingsOpen])

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
        {onZoomChange ? (
          <div className="flex items-center rounded-xl border border-border bg-surface-0">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
              onClick={() => onZoomChange(Math.max(50, zoom - 10))}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              className="min-w-[68px] px-2 text-sm font-medium text-text-primary"
              onClick={() => onZoomChange(100)}
              aria-label={`Zoom ${zoom}%`}
              title="Reset zoom"
            >
              {zoom}%
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
              onClick={() => onZoomChange(Math.min(200, zoom + 10))}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        ) : null}

        {settingsContent ? (
          <div ref={settingsRef} className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen((current) => !current)}
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal className="size-3.5" />
              Score setup
            </Button>

            {settingsOpen ? (
              <div
                className="absolute right-0 top-[calc(100%+10px)] z-30 w-[320px] rounded-[20px] border border-border bg-surface-0 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                role="dialog"
                aria-label="Score setup"
              >
                {settingsContent}
              </div>
            ) : null}
          </div>
        ) : null}

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
