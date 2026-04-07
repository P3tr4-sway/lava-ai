import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, CheckSquare, Search, Square, Trash2, X } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { Button, Input, Dialog } from '@/components/ui'
import { projectService } from '@/services/projectService'

export function MySongsPage() {
  const navigate = useNavigate()
  const projects = useProjectStore((s) => s.projects)
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const removeProject = useProjectStore((s) => s.removeProject)
  const [filter, setFilter] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteSelectionOpen, setDeleteSelectionOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filtered = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    return [...projects]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .filter((p) => p.name.toLowerCase().includes(normalized))
  }, [filter, projects])

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => projects.some((project) => project.id === id)))
  }, [projects])

  const selectionMode = selectedIds.length > 0
  const allFilteredSelected = filtered.length > 0 && filtered.every((project) => selectedIds.includes(project.id))

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )
  }

  const clearSelection = () => setSelectedIds([])

  const handleDeleteProjects = async (ids: string[]) => {
    if (ids.length === 0) return

    setIsDeleting(true)
    try {
      await Promise.all(ids.map((id) => projectService.delete(id)))
      ids.forEach((id) => removeProject(id))
      setDeleteId(null)
      setDeleteSelectionOpen(false)
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-text-primary">Projects</h1>
            <span className="rounded-full border border-border bg-surface-0 px-3 py-1 text-[13px] font-medium text-text-secondary">
              {projects.length}
            </span>
          </div>
          <p className="max-w-xl text-[15px] leading-[1.5] text-text-secondary">
            Your saved scores, tabs, and content versions.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search projects"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 pl-9 pr-9"
          />
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <p className="text-[13px] text-text-muted">
          {filter ? `${filtered.length} results` : 'Newest first'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (selectionMode) {
                clearSelection()
                return
              }
              const firstId = filtered[0]?.id
              if (firstId) setSelectedIds([firstId])
            }}
          >
            {selectionMode ? 'Done' : 'Select'}
          </Button>
          {selectionMode ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setSelectedIds(allFilteredSelected ? [] : filtered.map((project) => project.id))}
              >
                {allFilteredSelected ? 'Clear all' : 'Select all'}
              </Button>
              <p className="text-[13px] text-text-muted">
                {selectedIds.length} selected
              </p>
            </>
          ) : null}
        </div>

        {selectionMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={clearSelection}>Clear selection</Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteSelectionOpen(true)}
            >
              Delete selected
            </Button>
          </div>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((pack) => (
            <div
              key={pack.id}
              className="group relative flex items-center rounded-2xl border border-border bg-surface-0 transition-colors hover:bg-surface-1"
            >
              {selectionMode ? (
                <button
                  type="button"
                  onClick={() => toggleSelected(pack.id)}
                  className="ml-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  aria-label={selectedIds.includes(pack.id) ? `Deselect ${pack.name}` : `Select ${pack.name}`}
                >
                  {selectedIds.includes(pack.id) ? (
                    <CheckSquare className="size-4 text-text-primary" />
                  ) : (
                    <Square className="size-4" />
                  )}
                </button>
              ) : null}
              <button
                onClick={() => {
                  if (selectionMode) {
                    toggleSelected(pack.id)
                    return
                  }
                  navigate(`/pack/${pack.id}`)
                }}
                className="flex min-w-0 flex-1 items-center gap-4 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-medium leading-[1.3] text-text-primary">
                    {pack.name}
                  </span>
                  <span className="mt-1 block text-[13px] text-text-muted">
                    {new Date(pack.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className="hidden text-text-muted transition-colors group-hover:text-text-primary sm:inline-flex">
                  <ArrowUpRight className="size-4" />
                </span>
              </button>
              {!selectionMode ? (
                <button
                  onClick={() => setDeleteId(pack.id)}
                  className="p-3 text-text-muted opacity-100 transition-all hover:text-error focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Delete ${pack.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : filter ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-0 px-6 py-14 text-center">
          <p className="text-[18px] font-medium text-text-primary">No matches</p>
          <p className="text-[15px] leading-[1.5] text-text-secondary">
            Nothing matches &ldquo;{filter}&rdquo;.
          </p>
          <Button variant="outline" onClick={() => setFilter('')}>Clear search</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface-0 px-6 py-16 text-center">
          <p className="text-[20px] font-semibold tracking-[-0.02em] text-text-primary">
            No projects yet
          </p>
          <p className="max-w-md text-[15px] leading-[1.5] text-text-secondary">
            Create your first project and it will appear here.
          </p>
          <Button onClick={() => navigate('/')}>New project</Button>
        </div>
      )}

      {deleteId && (
        <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete project">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">This can’t be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={() => void handleDeleteProjects([deleteId])}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      <Dialog open={deleteSelectionOpen} onClose={() => setDeleteSelectionOpen(false)} title="Delete selected projects">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Delete {selectedIds.length} selected project{selectedIds.length === 1 ? '' : 's'}? This can’t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteSelectionOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isDeleting || selectedIds.length === 0}
              onClick={() => void handleDeleteProjects(selectedIds)}
            >
              {isDeleting ? 'Deleting...' : 'Delete selected'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
