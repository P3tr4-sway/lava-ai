import { useEffect, useMemo, useState } from 'react'
import type { Project } from '@lava/shared'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CheckSquare,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { Button, Dialog, Input, cn, useToast } from '@/components/ui'
import { projectService } from '@/services/projectService'

type LibraryCategory = 'projects' | 'sheet-music' | 'audio'
type LibraryOrigin = 'uploaded' | 'generated'
type ImportSourceKind = 'audio' | 'youtube' | 'musicxml' | 'pdf-image'

interface LibraryItem {
  id: string
  projectId: string
  category: LibraryCategory
  origin: LibraryOrigin | null
  title: string
  contextLabel: string
  summary: string
  formatLabel: string
  updatedAt: number
  searchText: string
}

const CATEGORY_OPTIONS: Array<{
  id: LibraryCategory
  label: string
}> = [
  {
    id: 'projects',
    label: 'Projects',
  },
  {
    id: 'sheet-music',
    label: 'Sheet Music',
  },
  {
    id: 'audio',
    label: 'Audio',
  },
]

const ORIGIN_OPTIONS: Array<{
  id: LibraryOrigin
  label: string
  icon: typeof Upload
}> = [
  { id: 'generated', label: 'Generated', icon: Sparkles },
  { id: 'uploaded', label: 'Uploaded', icon: Upload },
]

function getMetadata(project: Project) {
  return project.metadata as Record<string, unknown>
}

function getImportSource(metadata: Record<string, unknown>): ImportSourceKind | null {
  const value = metadata.importSource
  if (value === 'audio' || value === 'youtube' || value === 'musicxml' || value === 'pdf-image') {
    return value
  }
  return null
}

function getSourceLabel(project: Project, metadata: Record<string, unknown>) {
  return typeof metadata.sourceLabel === 'string' && metadata.sourceLabel.trim()
    ? metadata.sourceLabel.trim()
    : project.name
}

function getRequestSummary(metadata: Record<string, unknown>) {
  return typeof metadata.requestSummary === 'string' && metadata.requestSummary.trim()
    ? metadata.requestSummary.trim()
    : ''
}

function hasMusicXml(metadata: Record<string, unknown>) {
  return typeof metadata.musicXml === 'string' && metadata.musicXml.trim().length > 0
}

function getUpdatedAt(project: Project) {
  return project.updatedAt ?? project.createdAt
}

function buildLibraryItems(projects: Project[]): LibraryItem[] {
  return projects.flatMap((project) => {
    const metadata = getMetadata(project)
    const importSource = getImportSource(metadata)
    const sourceLabel = getSourceLabel(project, metadata)
    const requestSummary = getRequestSummary(metadata)
    const updatedAt = getUpdatedAt(project)
    const items: LibraryItem[] = [
      {
        id: `project:${project.id}`,
        projectId: project.id,
        category: 'projects',
        origin: null,
        title: project.name,
        contextLabel: importSource ? sourceLabel : 'Project',
        summary: requestSummary || 'Open and continue editing.',
        formatLabel: importSource ? describeImportSource(importSource) : 'Saved project',
        updatedAt,
        searchText: `${project.name} ${sourceLabel} ${requestSummary}`.toLowerCase(),
      },
    ]

    if (hasMusicXml(metadata)) {
      const origin: LibraryOrigin =
        importSource === 'musicxml' || importSource === 'pdf-image' ? 'uploaded' : 'generated'

      items.push({
        id: `sheet:${project.id}`,
        projectId: project.id,
        category: 'sheet-music',
        origin,
        title: sourceLabel,
        contextLabel: project.name,
        summary:
          requestSummary
          || (origin === 'uploaded' ? 'Imported score source.' : 'Generated score ready to open.'),
        formatLabel:
          importSource === 'musicxml'
            ? 'MusicXML'
            : importSource === 'pdf-image'
              ? 'PDF / Image'
              : 'Editable score',
        updatedAt,
        searchText: `${sourceLabel} ${project.name} ${requestSummary} score sheet music`.toLowerCase(),
      })
    }

    if (importSource === 'audio' || importSource === 'youtube') {
      items.push({
        id: `audio:${project.id}`,
        projectId: project.id,
        category: 'audio',
        origin: 'uploaded',
        title: sourceLabel,
        contextLabel: project.name,
        summary: requestSummary || 'Source audio linked to this project.',
        formatLabel: importSource === 'youtube' ? 'YouTube audio' : 'Audio upload',
        updatedAt,
        searchText: `${sourceLabel} ${project.name} ${requestSummary} audio`.toLowerCase(),
      })
    }

    return items
  })
}

function describeImportSource(source: ImportSourceKind) {
  switch (source) {
    case 'audio':
      return 'Audio import'
    case 'youtube':
      return 'YouTube import'
    case 'musicxml':
      return 'MusicXML import'
    case 'pdf-image':
      return 'PDF / Image import'
    default:
      return 'Saved project'
  }
}

function formatDateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getCategoryLabel(category: LibraryCategory) {
  return CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? 'Items'
}

function getOriginLabel(origin: LibraryOrigin) {
  return ORIGIN_OPTIONS.find((option) => option.id === origin)?.label ?? origin
}

function CategoryButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[108px] flex-col items-start justify-between rounded-[24px] px-5 py-4 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        active
          ? 'bg-text-primary text-surface-0'
          : 'bg-surface-0 text-text-primary hover:bg-surface-1',
      )}
      aria-pressed={active}
    >
      <span className="text-[17px] font-medium tracking-[-0.02em]">{label}</span>
      <p className={cn('text-[36px] font-semibold tracking-[-0.05em]', active ? 'text-surface-0' : 'text-text-primary')}>
        {count}
      </p>
    </button>
  )
}

function OriginButton({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  count: number
  icon: typeof Upload
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        active
          ? 'bg-text-primary text-surface-0'
          : 'bg-surface-0 text-text-secondary hover:bg-surface-1 hover:text-text-primary',
      )}
      aria-pressed={active}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      <span className={cn('rounded-full px-2 py-0.5 text-xs', active ? 'bg-white/12' : 'bg-surface-2')}>
        {count}
      </span>
    </button>
  )
}

function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-[96px] animate-pulse rounded-[24px] bg-surface-0 px-5 py-4"
        >
          <div className="flex flex-1 flex-col gap-3">
            <div className="h-4 w-32 rounded-full bg-surface-2" />
            <div className="h-6 w-2/3 rounded-full bg-surface-2" />
            <div className="h-4 w-1/2 rounded-full bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  actionLabel,
  description,
  onAction,
  title,
}: {
  actionLabel: string
  description: string
  onAction: () => void
  title: string
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[28px] bg-surface-0 px-6 py-16 text-center">
      <div className="space-y-2">
        <p className="text-[22px] font-semibold tracking-[-0.03em] text-text-primary">{title}</p>
        <p className="max-w-md text-[15px] leading-[1.5] text-text-secondary">{description}</p>
      </div>
      <Button onClick={onAction}>{actionLabel}</Button>
    </div>
  )
}

export function MySongsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const projects = useProjectStore((s) => s.projects)
  const loading = useProjectStore((s) => s.loading)
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const removeProject = useProjectStore((s) => s.removeProject)
  const [filter, setFilter] = useState('')
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('projects')
  const [activeOrigin, setActiveOrigin] = useState<LibraryOrigin>('generated')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteSelectionOpen, setDeleteSelectionOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (activeCategory !== 'projects' && selectedIds.length > 0) {
      setSelectedIds([])
    }
  }, [activeCategory, selectedIds.length])

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => projects.some((project) => project.id === id)))
  }, [projects])

  const libraryItems = useMemo(() => buildLibraryItems(projects), [projects])

  const countsByCategory = useMemo(() => ({
    projects: libraryItems.filter((item) => item.category === 'projects').length,
    'sheet-music': libraryItems.filter((item) => item.category === 'sheet-music').length,
    audio: libraryItems.filter((item) => item.category === 'audio').length,
  }), [libraryItems])

  const countsByOrigin = useMemo(() => ({
    uploaded: libraryItems.filter((item) => item.category === activeCategory && item.origin === 'uploaded').length,
    generated: libraryItems.filter((item) => item.category === activeCategory && item.origin === 'generated').length,
  }), [activeCategory, libraryItems])

  const visibleItems = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    return libraryItems
      .filter((item) => {
        if (item.category !== activeCategory) return false
        if (activeCategory !== 'projects' && item.origin !== activeOrigin) return false
        if (!normalized) return true
        return item.searchText.includes(normalized)
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [activeCategory, activeOrigin, filter, libraryItems])

  const projectItems = useMemo(
    () => visibleItems.filter((item) => item.category === 'projects'),
    [visibleItems],
  )

  const selectionMode = activeCategory === 'projects' && selectedIds.length > 0
  const allVisibleSelected =
    projectItems.length > 0 && projectItems.every((item) => selectedIds.includes(item.projectId))

  const toggleSelected = (projectId: string) => {
    setSelectedIds((current) =>
      current.includes(projectId)
        ? current.filter((value) => value !== projectId)
        : [...current, projectId],
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
      toast(
        ids.length === 1 ? 'Project deleted.' : `${ids.length} projects deleted.`,
        'success',
      )
    } catch (error) {
      console.error('Failed to delete project selection', error)
      toast('Could not delete the selected projects.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const searchPlaceholder = activeCategory === 'projects'
    ? 'Search projects'
    : activeCategory === 'sheet-music'
      ? 'Search sheet music'
      : 'Search audio'

  const resultLabel = filter
    ? `${visibleItems.length} results`
    : activeCategory === 'projects'
      ? 'Newest updated first'
      : `${getOriginLabel(activeOrigin)} in ${getCategoryLabel(activeCategory)}`

  const emptyTitle = filter
    ? 'No matches'
    : activeCategory === 'projects'
      ? 'No projects yet'
      : `No ${activeOrigin} ${activeCategory === 'sheet-music' ? 'sheet music' : 'audio'} yet`

  const emptyDescription = filter
    ? `Nothing matches "${filter}" in ${getCategoryLabel(activeCategory)}.`
    : activeCategory === 'projects'
      ? 'Create your first project and it will appear here.'
      : activeCategory === 'sheet-music'
        ? activeOrigin === 'uploaded'
          ? 'Imported scores will show up here once you bring in MusicXML, PDF, or image files.'
          : 'Generated scores from prompts, audio, or remix flows will show up here.'
        : activeOrigin === 'uploaded'
          ? 'Uploaded audio sources will show up here once you import or record them.'
          : 'Generated audio will show up here once that workflow is available.'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-text-primary">Files</h1>
            <span className="rounded-full bg-surface-0 px-3 py-1 text-[13px] font-medium text-text-secondary">
              {countsByCategory.projects}
            </span>
          </div>
          <p className="max-w-2xl text-[15px] leading-[1.5] text-text-secondary">
            Manage projects, scores, and audio.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {CATEGORY_OPTIONS.map((option) => (
            <CategoryButton
              key={option.id}
              active={activeCategory === option.id}
              count={countsByCategory[option.id]}
              label={option.label}
              onClick={() => setActiveCategory(option.id)}
            />
          ))}
        </div>
      </div>

      {activeCategory !== 'projects' ? (
        <div className="flex flex-wrap items-center gap-2">
          {ORIGIN_OPTIONS.map((option) => (
            <OriginButton
              key={option.id}
              active={activeOrigin === option.id}
              count={countsByOrigin[option.id]}
              icon={option.icon}
              label={option.label}
              onClick={() => setActiveOrigin(option.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-11 rounded-full border-0 bg-surface-0 pl-10 pr-10"
          />
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {activeCategory !== 'projects' || filter ? (
          <p className="text-[13px] text-text-muted">{resultLabel}</p>
        ) : null}
      </div>

      {activeCategory === 'projects' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={projectItems.length === 0}
              onClick={() => {
                if (selectionMode) {
                  clearSelection()
                  return
                }
                const firstId = projectItems[0]?.projectId
                if (firstId) setSelectedIds([firstId])
              }}
            >
              {selectionMode ? 'Done' : 'Select'}
            </Button>

            {selectionMode ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setSelectedIds(
                      allVisibleSelected ? [] : projectItems.map((item) => item.projectId),
                    )
                  }
                >
                  {allVisibleSelected ? 'Clear all' : 'Select all'}
                </Button>
                <p className="text-[13px] text-text-muted">{selectedIds.length} selected</p>
              </>
            ) : null}
          </div>

          {selectionMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={clearSelection}>Clear selection</Button>
              <Button variant="destructive" onClick={() => setDeleteSelectionOpen(true)}>
                Delete selected
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading && libraryItems.length === 0 ? (
        <LibrarySkeleton />
      ) : visibleItems.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visibleItems.map((item) => {
            const showDeleteButton = activeCategory === 'projects' && !selectionMode
            const isSelected = selectedIds.includes(item.projectId)
            const originLabel = item.origin ? getOriginLabel(item.origin) : null

            return (
              <div
                key={item.id}
                className={cn(
                  'group relative flex items-center rounded-[24px] bg-surface-0 transition-colors',
                  activeCategory === 'projects' && isSelected && 'bg-surface-1',
                  showDeleteButton && 'hover:bg-surface-1',
                )}
              >
                {activeCategory === 'projects' && selectionMode ? (
                  <button
                    type="button"
                    onClick={() => toggleSelected(item.projectId)}
                    className="ml-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    aria-label={isSelected ? `Deselect ${item.title}` : `Select ${item.title}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4 text-text-primary" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (activeCategory === 'projects' && selectionMode) {
                      toggleSelected(item.projectId)
                      return
                    }
                    navigate(`/pack/${item.projectId}`)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4 text-left focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="block truncate text-[18px] font-medium tracking-[-0.02em] text-text-primary">
                        {item.title}
                      </span>
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
                        {item.formatLabel}
                      </span>
                      {originLabel ? (
                        <span className="rounded-full bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                          {originLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <p className="text-[14px] font-medium text-text-secondary">{item.contextLabel}</p>
                      <p className="line-clamp-1 text-[14px] leading-[1.45] text-text-muted">{item.summary}</p>
                    </div>

                    <p className="text-[12px] text-text-muted">Updated {formatDateLabel(item.updatedAt)}</p>
                  </div>

                  <span className="hidden text-text-muted transition-colors group-hover:text-text-primary sm:inline-flex">
                    <ArrowUpRight className="size-4" />
                  </span>
                </button>

                {showDeleteButton ? (
                  <button
                    type="button"
                    onClick={() => setDeleteId(item.projectId)}
                    className="p-3 text-text-muted opacity-100 transition-all hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={filter ? 'Clear search' : activeCategory === 'projects' ? 'New project' : 'Open home'}
          onAction={() => {
            if (filter) {
              setFilter('')
              return
            }
            navigate('/')
          }}
        />
      )}

      {deleteId ? (
        <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} title="Delete project">
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
      ) : null}

      <Dialog
        open={deleteSelectionOpen}
        onClose={() => setDeleteSelectionOpen(false)}
        title="Delete selected projects"
      >
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
