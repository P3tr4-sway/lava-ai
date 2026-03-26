import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import { FolderOpen, Plus, BookOpen, Music, Layers, Wrench, Library, ArrowRight, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { projectService } from '@/services/projectService'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import type { Project, SpaceType } from '@lava/shared'

// ─── Constants ────────────────────────────────────────────────────────────────

const SPACE_ICONS: Record<SpaceType, React.ElementType> = {
  learn: BookOpen,
  jam: Music,
  create: Layers,
  tools: Wrench,
  library: Library,
  projects: FolderOpen,
}

const MODULE_LABELS: Record<string, string> = {
  learn: 'Practice',
  jam: 'Session',
  create: 'Charts',
  tools: 'Tools',
  library: 'Library',
  projects: 'Projects',
}

const FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Practice Charts', value: 'learn' },
  { label: 'Recordings', value: 'create' },
  { label: 'Backing Tracks', value: 'jam' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getProjectRoute(project: Project): string {
  if (project.space === 'learn') {
    return `/editor/${project.id}`
  }
  if (project.space === 'jam') return '/tools'
  return '/projects'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyProjectsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const projects = useProjectStore((s) => s.projects)
  const loading = useProjectStore((s) => s.loading)
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const removeProject = useProjectStore((s) => s.removeProject)
  const [filter, setFilter] = useState('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setDeleting(project.id)
    try {
      await projectService.delete(project.id)
      removeProject(project.id)
    } catch (err) {
      console.error('Delete project failed:', err)
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    setSpaceContext({ currentSpace: 'projects', projectId: id })
  }, [id, setSpaceContext])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const filtered = projects
    .filter((p) => filter === 'all' || p.space === filter)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  if (!isAuthenticated) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <FolderOpen size={48} className="text-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Your practice library will appear here</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-sm">
            Sign up for a free account to save your charts, recordings, tones, and practice progress
          </p>
          <Button onClick={() => navigate('/signup')}>Sign Up Free</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FolderOpen size={20} className="text-text-secondary" />
            <h1 className="text-xl font-semibold">My Practice Library</h1>
          </div>
          <p className="text-text-secondary text-sm">Your saved charts, recordings, and practice sessions.</p>
        </div>
        <Button>
          <Plus size={14} /> New Project
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} defaultValue="all" onValueChange={setFilter}>
        <TabsList className="w-fit mb-6">
          {FILTER_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((project) => {
            const Icon = SPACE_ICONS[project.space]
            const moduleLabel = MODULE_LABELS[project.space] ?? project.space
            return (
              <div
                key={project.id}
                className="flex flex-col gap-3 bg-surface-2 border border-border rounded-md p-4 hover:bg-surface-3 hover:border-border-hover transition-colors"
              >
                {/* Module tag */}
                <div className="flex items-center gap-2">
                  <Icon size={12} className="text-text-secondary" />
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary">
                    {moduleLabel}
                  </span>
                </div>

                {/* Title */}
                <p className="text-sm font-medium text-text-primary">{project.name}</p>
                {project.description && (
                  <p className="text-xs text-text-muted">{project.description}</p>
                )}

                {/* Footer: last modified + Continue */}
                <div className="flex items-center justify-between mt-auto pt-1">
                  <p className="text-2xs text-text-muted">
                    {formatRelativeTime(project.updatedAt)}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(project)}
                      disabled={deleting === project.id}
                      className="flex items-center justify-center size-6 rounded text-text-muted hover:text-error hover:bg-surface-3 transition-colors disabled:opacity-50"
                      title="Delete project"
                    >
                      {deleting === project.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                    <button
                      onClick={() => navigate(getProjectRoute(project))}
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Open <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FolderOpen size={48} className="text-text-muted mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">Nothing here yet</h3>
      <p className="text-sm text-text-secondary mb-6 max-w-sm">
        Search for a song to practice or create your own charts
      </p>
      <div className="flex gap-3">
        <Button onClick={() => navigate('/')}>Find a Song</Button>
        <Button variant="outline" onClick={() => navigate('/editor')}>New Chart</Button>
      </div>
    </div>
  )
}
