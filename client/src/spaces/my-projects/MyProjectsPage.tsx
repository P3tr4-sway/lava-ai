import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useProjectStore } from '@/stores/projectStore'
import { FolderOpen, Plus, BookOpen, Music, Layers, Wrench, Library, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
  learn: 'Score',
  jam: 'Jam',
  create: 'Create',
  tools: 'Tools',
  library: 'Library',
  projects: 'Projects',
}

const FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Scores', value: 'learn' },
  { label: 'Jam', value: 'jam' },
  { label: 'Create', value: 'create' },
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
  if (project.space === 'learn' && typeof project.metadata.songId === 'string') {
    return `/play/${project.metadata.songId}`
  }
  if (project.space === 'jam') return '/jam'
  return '/projects'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyProjectsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const projects = useProjectStore((s) => s.projects)
  const loading = useProjectStore((s) => s.loading)
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setSpaceContext({ currentSpace: 'projects', projectId: id })
  }, [id, setSpaceContext])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const filtered = projects
    .filter((p) => filter === 'all' || p.space === filter)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FolderOpen size={20} className="text-text-secondary" />
            <h1 className="text-xl font-semibold">My Projects</h1>
          </div>
          <p className="text-text-secondary text-sm">All your saved work, across every space.</p>
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
                  <button
                    onClick={() => navigate(getProjectRoute(project))}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Open <ArrowRight size={12} />
                  </button>
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
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
        <FolderOpen size={24} className="text-text-muted" />
      </div>
      <p className="text-sm font-medium mb-1">No projects yet</p>
      <p className="text-xs text-text-muted max-w-xs">
        Record a take on any song score and save it to create your first project.
      </p>
    </div>
  )
}
