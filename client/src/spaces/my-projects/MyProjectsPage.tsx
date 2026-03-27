import { useEffect, useMemo, useState, type ElementType } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  FolderOpen,
  Home,
  Layers,
  Library,
  ListMusic,
  Loader2,
  Music,
  PencilLine,
  Plus,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { cn } from '@/components/ui/utils'
import { CHORD_CHARTS, type ChordChart } from '@/data/chordCharts'
import { useAgentStore } from '@/stores/agentStore'
import { useAuthStore } from '@/stores/authStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useProjectStore } from '@/stores/projectStore'
import { projectService } from '@/services/projectService'
import type { Project, SpaceType } from '@lava/shared'

type LibraryView = 'playlists' | 'projects'

const SPACE_ICONS: Record<SpaceType, ElementType> = {
  home: Home,
  learn: BookOpen,
  jam: Music,
  tone: SlidersHorizontal,
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
  if (project.space === 'learn') return `/editor/${project.id}`
  if (project.space === 'tools' && project.metadata?.type === 'tone-patch') return `/tools/new?projectId=${project.id}`
  if (project.space === 'jam') return '/?tab=tools'
  return '/projects'
}

export function MyProjectsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  const projects = useProjectStore((s) => s.projects)
  const loading = useProjectStore((s) => s.loading)
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const removeProject = useProjectStore((s) => s.removeProject)

  const playlists = usePlaylistStore((s) => s.playlists)
  const selectedPlaylistId = usePlaylistStore((s) => s.selectedPlaylistId)
  const setSelectedPlaylist = usePlaylistStore((s) => s.setSelectedPlaylist)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const renamePlaylist = usePlaylistStore((s) => s.renamePlaylist)
  const deletePlaylist = usePlaylistStore((s) => s.deletePlaylist)
  const removeSongFromPlaylist = usePlaylistStore((s) => s.removeSongFromPlaylist)

  const [filter, setFilter] = useState('all')
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [showPlaylistComposer, setShowPlaylistComposer] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')

  const requestedView = searchParams.get('view')
  const requestedPlaylistId = searchParams.get('playlist')
  const currentView: LibraryView = requestedView === 'playlists' ? 'playlists' : 'projects'

  useEffect(() => {
    setSpaceContext({ currentSpace: 'projects', projectId: id })
  }, [id, setSpaceContext])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => b.updatedAt - a.updatedAt),
    [playlists],
  )

  const selectedPlaylist =
    sortedPlaylists.find((playlist) => playlist.id === requestedPlaylistId) ??
    sortedPlaylists.find((playlist) => playlist.id === selectedPlaylistId) ??
    sortedPlaylists[0] ??
    null

  const selectedPlaylistSongs = useMemo(
    () =>
      (selectedPlaylist?.songIds ?? [])
        .map((songId) => CHORD_CHARTS.find((chart) => chart.id === songId))
        .filter((song): song is ChordChart => Boolean(song)),
    [selectedPlaylist],
  )

  useEffect(() => {
    if (selectedPlaylist?.id) {
      setSelectedPlaylist(selectedPlaylist.id)
      setRenameDraft(selectedPlaylist.title)
    } else {
      setRenameDraft('')
    }
  }, [selectedPlaylist?.id, selectedPlaylist?.title, setSelectedPlaylist])

  useEffect(() => {
    if (currentView !== 'playlists') return
    if (!selectedPlaylist?.id) return
    if (requestedPlaylistId === selectedPlaylist.id) return

    const next = new URLSearchParams(searchParams)
    next.set('view', 'playlists')
    next.set('playlist', selectedPlaylist.id)
    setSearchParams(next, { replace: true })
  }, [currentView, requestedPlaylistId, searchParams, selectedPlaylist?.id, setSearchParams])

  const filteredProjects = projects
    .filter((project) => filter === 'all' || project.space === filter)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const setLibraryView = (view: LibraryView, playlistId?: string | null) => {
    const next = new URLSearchParams(searchParams)

    if (view === 'playlists') {
      next.set('view', 'playlists')
      const nextPlaylistId = playlistId ?? selectedPlaylist?.id ?? null
      if (nextPlaylistId) next.set('playlist', nextPlaylistId)
      else next.delete('playlist')
    } else {
      next.set('view', 'projects')
      next.delete('playlist')
    }

    setSearchParams(next)
  }

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setDeletingProjectId(project.id)
    try {
      await projectService.delete(project.id)
      removeProject(project.id)
    } catch (err) {
      console.error('Delete project failed:', err)
    } finally {
      setDeletingProjectId(null)
    }
  }

  const handleCreatePlaylist = () => {
    const trimmed = newPlaylistName.trim()
    if (!trimmed) return
    const playlistId = createPlaylist(trimmed)
    setNewPlaylistName('')
    setShowPlaylistComposer(false)
    setLibraryView('playlists', playlistId)
  }

  const handleDeletePlaylist = () => {
    if (!selectedPlaylist) return
    if (!window.confirm(`Delete "${selectedPlaylist.title}"?`)) return
    deletePlaylist(selectedPlaylist.id)
  }

  const handleRenamePlaylist = () => {
    if (!selectedPlaylist) return
    if (!renameDraft.trim()) return
    renamePlaylist(selectedPlaylist.id, renameDraft)
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <FolderOpen size={48} className="mb-4 text-text-muted" />
          <h3 className="mb-2 text-lg font-semibold text-text-primary">Your projects will appear here</h3>
          <p className="mb-6 max-w-sm text-sm text-text-secondary">
            Sign up for a free account to save your charts, recordings, tones, and collections.
          </p>
          <Button onClick={() => navigate('/signup')}>Sign Up Free</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <FolderOpen size={20} className="text-text-secondary" />
            <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
          </div>
          <p className="text-sm text-text-secondary">
            Organize saved collections, recordings, and practice projects.
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setLibraryView('playlists')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            currentView === 'playlists'
              ? 'bg-surface-3 text-text-primary'
              : 'bg-surface-1 text-text-secondary hover:text-text-primary',
          )}
        >
          Collections
        </button>
        <button
          type="button"
          onClick={() => setLibraryView('projects')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            currentView === 'projects'
              ? 'bg-surface-3 text-text-primary'
              : 'bg-surface-1 text-text-secondary hover:text-text-primary',
          )}
        >
          Projects
        </button>
      </div>

      {currentView === 'playlists' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <ListMusic size={16} className="text-text-secondary" />
                  <p className="text-sm font-semibold text-text-primary">Collections</p>
                </div>
                <p className="text-xs text-text-secondary">Recently updated first.</p>
              </div>
              <Button variant="outline" onClick={() => setShowPlaylistComposer((value) => !value)}>
                <Plus size={14} /> New collection
              </Button>
            </div>

            {showPlaylistComposer && (
              <div className="mb-4 rounded-lg border border-border bg-surface-1 p-3">
                <div className="flex flex-col gap-3">
                  <Input
                    label="Collection name"
                    value={newPlaylistName}
                    onChange={(event) => setNewPlaylistName(event.target.value)}
                    placeholder="Late night charts"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim()}>
                      Create collection
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowPlaylistComposer(false); setNewPlaylistName('') }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {sortedPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => setLibraryView('playlists', playlist.id)}
                  className={cn(
                    'rounded-lg border px-4 py-3 text-left transition-colors',
                    selectedPlaylist?.id === playlist.id
                      ? 'border-border-hover bg-surface-1'
                      : 'border-transparent bg-surface-1 hover:border-border',
                  )}
                >
                  <p className="text-sm font-medium text-text-primary">{playlist.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">{playlist.songIds.length} charts</p>
                </button>
              ))}

              {sortedPlaylists.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-secondary">
                  No collections yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4 md:p-5">
            {selectedPlaylist ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-semibold text-text-primary">{selectedPlaylist.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{selectedPlaylist.songIds.length} charts</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate('/')}>
                    Find charts
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <Input
                      label="Collection name"
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      placeholder="Collection name"
                      className="h-10"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleRenamePlaylist} disabled={!renameDraft.trim() || renameDraft.trim() === selectedPlaylist.title}>
                        <PencilLine size={14} /> Rename collection
                      </Button>
                      <Button variant="outline" onClick={handleDeletePlaylist}>
                        <Trash2 size={14} /> Delete collection
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {selectedPlaylistSongs.length > 0 ? (
                    selectedPlaylistSongs.map((song) => (
                      <div
                        key={song.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{song.title}</p>
                          <p className="mt-1 truncate text-xs text-text-secondary">
                            {song.artist ?? song.style} · Key {song.key} · {song.tempo ?? '--'} BPM
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={() => navigate(`/play/${song.id}`)}>
                            Open chart
                          </Button>
                          <button
                            type="button"
                            onClick={() => removeSongFromPlaylist(selectedPlaylist.id, song.id)}
                            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                            aria-label={`Remove ${song.title}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-surface-1 px-4 py-12 text-center">
                      <p className="text-sm text-text-secondary">This collection is empty.</p>
                      <Button className="mt-4" onClick={() => navigate('/')}>Add charts from Home</Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <ListMusic size={40} className="mb-4 text-text-muted" />
                <p className="text-lg font-semibold text-text-primary">No collection selected</p>
                <p className="mt-2 text-sm text-text-secondary">Create a collection or save chord charts from Home.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <Tabs value={filter} defaultValue="all" onValueChange={setFilter}>
            <TabsList className="mb-6 w-fit">
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
          ) : filteredProjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                const Icon = SPACE_ICONS[project.space]
                const moduleLabel = MODULE_LABELS[project.space] ?? project.space

                return (
                  <div
                    key={project.id}
                    className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-4 transition-colors hover:border-border-hover hover:bg-surface-3"
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={12} className="text-text-secondary" />
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-2xs text-text-secondary">
                        {moduleLabel}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-text-primary">{project.name}</p>
                    {project.description && <p className="text-xs text-text-muted">{project.description}</p>}

                    <div className="mt-auto flex items-center justify-between pt-1">
                      <p className="text-2xs text-text-muted">{formatRelativeTime(project.updatedAt)}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteProject(project)}
                          disabled={deletingProjectId === project.id}
                          className="flex size-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-3 hover:text-error disabled:opacity-50"
                          title="Delete project"
                        >
                          {deletingProjectId === project.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                        <button
                          onClick={() => navigate(getProjectRoute(project))}
                          className="flex items-center gap-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
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
        </>
      )}
    </div>
  )
}

function EmptyState() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FolderOpen size={48} className="mb-4 text-text-muted" />
      <h3 className="mb-2 text-lg font-semibold text-text-primary">Nothing here yet</h3>
      <p className="mb-6 max-w-sm text-sm text-text-secondary">
        Search for a song to practice or create your own charts.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => navigate('/')}>Find a Song</Button>
        <Button variant="outline" onClick={() => navigate('/editor')}>New Chart</Button>
      </div>
    </div>
  )
}
