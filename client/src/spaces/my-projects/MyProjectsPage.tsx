import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useProjectStore } from '@/stores/projectStore'
import { FolderOpen, Plus, BookOpen, Music, Layers, Wrench, Library } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { SpaceType } from '@lava/shared'

const SPACE_ICONS: Record<SpaceType, React.ElementType> = {
  learn: BookOpen,
  jam: Music,
  create: Layers,
  tools: Wrench,
  library: Library,
  projects: FolderOpen,
}

export function MyProjectsPage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const projects = useProjectStore((s) => s.projects)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'projects', projectId: id })
  }, [id, setSpaceContext])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
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

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((project) => {
            const Icon = SPACE_ICONS[project.space]
            return (
              <Card key={project.id} hoverable className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-text-secondary" />
                  <span className="text-xs text-text-muted capitalize">{project.space}</span>
                </div>
                <p className="text-sm font-medium">{project.name}</p>
                {project.description && (
                  <p className="text-xs text-text-muted">{project.description}</p>
                )}
                <p className="text-2xs text-text-muted mt-auto">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </Card>
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
        Start by exploring a space or ask LAVA AI to create a new project for you.
      </p>
    </div>
  )
}
