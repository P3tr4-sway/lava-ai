import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, X, ArrowRight } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { Button } from '@/components/ui/Button'
import type { SpaceType } from '@lava/shared'

const MODULE_ROUTES: Partial<Record<SpaceType, string>> = {
  learn: '/learn',
  jam: '/tools',
  create: '/create',
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

interface ModuleDrawerProps {
  moduleSpace: SpaceType
  label: string
}

export function ModuleDrawer({ moduleSpace, label }: ModuleDrawerProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const projects = useProjectStore((s) => s.projects)
  const filtered = projects
    .filter((p) => p.space === moduleSpace)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open])

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary bg-surface-2 border border-border rounded-full hover:border-border-hover hover:text-text-primary transition-colors shrink-0"
      >
        <FolderOpen size={12} />
        {label}
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-80 bg-surface-1 border-l border-border flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={14} className="text-text-secondary" />
            <span className="text-sm font-medium text-text-primary">{label}</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center size-7 rounded text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen size={20} className="text-text-muted mb-2" />
              <p className="text-xs text-text-muted">No saved items yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 bg-surface-2 border border-border rounded-md p-3 hover:border-border-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {project.name}
                    </p>
                    <p className="text-2xs text-text-muted mt-0.5">
                      {formatRelativeTime(project.updatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigate(MODULE_ROUTES[moduleSpace] ?? '/projects')
                      setOpen(false)
                    }}
                  >
                    Open <ArrowRight size={12} className="ml-0.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
