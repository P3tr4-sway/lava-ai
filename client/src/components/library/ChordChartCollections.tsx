import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { usePlaylistStore, type PlaylistItem } from '@/stores/playlistStore'
import { CHORD_CHARTS, type ChordChart } from '@/data/chordCharts'
import { ChordChartGrid } from './ChordChartGrid'

function chordChartMatchesQuery(chart: ChordChart, query: string) {
  if (!query) return true

  const haystack = [
    chart.title,
    chart.artist,
    chart.style,
    chart.key,
    chart.tempo ? `${chart.tempo} bpm` : undefined,
    chart.timeSignature,
    chart.tuning,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function playlistMatchesQuery(playlist: PlaylistItem, songs: ChordChart[], query: string) {
  if (!query) return true

  if (playlist.title.toLowerCase().includes(query)) {
    return true
  }

  return songs.some((song) => chordChartMatchesQuery(song, query))
}

function CollectionPreview({ songs }: { songs: ChordChart[] }) {
  const previewSongs = songs.slice(0, 3)

  return (
    <div className="rounded-md bg-surface-1 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">Includes</p>
      <div className="mt-3 space-y-2">
        {previewSongs.map((song) => (
          <div key={song.id} className="rounded border border-border bg-surface-0 px-3 py-2">
            <p className="truncate text-sm font-medium text-text-primary">{song.title}</p>
            <p className="truncate text-xs text-text-muted">{song.artist ?? song.style}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CollectionCard({
  playlist,
  songs,
  onClick,
}: {
  playlist: PlaylistItem
  songs: ChordChart[]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col gap-4 rounded-md border border-border bg-surface-0 p-4 text-left transition-colors hover:border-border-hover hover:bg-surface-1"
    >
      <CollectionPreview songs={songs} />
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold tracking-tight text-text-primary">{playlist.title}</p>
          <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-text-secondary">
            {songs.length} charts
          </span>
        </div>
        <p className="text-sm text-text-secondary">Open collection</p>
      </div>
    </button>
  )
}

function EmptyResults({
  query,
  label,
}: {
  query: string
  label: string
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-1 px-6 py-12 text-center">
      <p className="text-base font-medium text-text-primary">No {label} found for “{query}”.</p>
      <p className="mt-2 text-sm text-text-secondary">Try a different keyword.</p>
    </div>
  )
}

export function ChordChartCollections({
  query,
  onOpenChart,
}: {
  query: string
  onOpenChart: (chart: ChordChart) => void
}) {
  const playlists = usePlaylistStore((s) => s.playlists)
  const setSelectedPlaylist = usePlaylistStore((s) => s.setSelectedPlaylist)
  const [focusedPlaylistId, setFocusedPlaylistId] = useState<string | null>(null)

  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => b.updatedAt - a.updatedAt),
    [playlists],
  )

  const playlistEntries = useMemo(
    () =>
      sortedPlaylists.map((playlist) => ({
        playlist,
        songs: playlist.songIds
          .map((songId) => CHORD_CHARTS.find((chart) => chart.id === songId))
          .filter((song): song is ChordChart => Boolean(song)),
      })),
    [sortedPlaylists],
  )

  const filteredPlaylists = useMemo(
    () => playlistEntries.filter(({ playlist, songs }) => playlistMatchesQuery(playlist, songs, query)),
    [playlistEntries, query],
  )

  const focusedPlaylist = focusedPlaylistId
    ? playlistEntries.find(({ playlist }) => playlist.id === focusedPlaylistId) ?? null
    : null

  const filteredFocusedSongs = useMemo(
    () => (focusedPlaylist ? focusedPlaylist.songs.filter((song) => chordChartMatchesQuery(song, query)) : []),
    [focusedPlaylist, query],
  )

  if (focusedPlaylist) {
    return (
      <section className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => setFocusedPlaylistId(null)}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft size={16} />
          Back to collections
        </button>

        <div className="grid gap-4 rounded-md border border-border bg-surface-0 p-4 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="min-w-0">
            <CollectionPreview songs={focusedPlaylist.songs} />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight text-text-primary">{focusedPlaylist.playlist.title}</p>
            <p className="text-sm text-text-secondary">{focusedPlaylist.songs.length} charts</p>
          </div>
        </div>

        {filteredFocusedSongs.length > 0 ? (
          <ChordChartGrid charts={filteredFocusedSongs} onSelect={onOpenChart} />
        ) : (
          <EmptyResults query={query} label="chord charts in this collection" />
        )}
      </section>
    )
  }

  return filteredPlaylists.length > 0 ? (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {filteredPlaylists.map(({ playlist, songs }) => (
        <CollectionCard
          key={playlist.id}
          playlist={playlist}
          songs={songs}
          onClick={() => {
            setFocusedPlaylistId(playlist.id)
            setSelectedPlaylist(playlist.id)
          }}
        />
      ))}
    </section>
  ) : (
    <EmptyResults query={query} label="collections" />
  )
}
