import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { Button, Input, Dialog } from '@/components/ui'

export function MySongsPage() {
  const navigate = useNavigate()
  const projects = useProjectStore((s) => s.projects)
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const removeProject = useProjectStore((s) => s.removeProject)
  const [filter, setFilter] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-primary">My Songs</h1>

      {/* Search */}
      <Input
        placeholder="Search songs..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {/* Pack list */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((pack) => (
            <div
              key={pack.id}
              className="relative flex items-center rounded-lg border border-border bg-surface-0 hover:bg-surface-1 transition-colors group"
            >
              <button
                onClick={() => navigate(`/pack/${pack.id}`)}
                className="flex flex-col gap-1 flex-1 min-w-0 p-4 text-left"
              >
                <span className="text-base font-medium text-text-primary truncate">
                  {pack.name}
                </span>
                <span className="text-sm text-text-muted">
                  {new Date(pack.createdAt).toLocaleDateString()}
                </span>
              </button>
              <button
                onClick={() => setDeleteId(pack.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-3 text-text-muted hover:text-error transition-all flex-shrink-0"
                aria-label={`Delete ${pack.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : filter ? (
        <p className="text-sm text-text-muted text-center py-8">
          No songs match &ldquo;{filter}&rdquo;
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-text-muted">
            No songs yet. Head home to create your first practice pack.
          </p>
          <Button onClick={() => navigate('/')}>Create a pack</Button>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete this song?">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  removeProject(deleteId)
                  setDeleteId(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
