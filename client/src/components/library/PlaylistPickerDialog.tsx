import { useEffect, useMemo, useState } from 'react'
import { Button, Dialog, Input } from '@/components/ui'
import { usePlaylistStore } from '@/stores/playlistStore'
import type { ChordChart } from '@/data/chordCharts'

interface PlaylistPickerDialogProps {
  open: boolean
  song: ChordChart | null
  onClose: () => void
  onSavedChange?: (playlistId: string, action: 'saved' | 'removed') => void
}

export function PlaylistPickerDialog({ open, song, onClose, onSavedChange }: PlaylistPickerDialogProps) {
  const playlists = usePlaylistStore((s) => s.playlists)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const addSongToPlaylist = usePlaylistStore((s) => s.addSongToPlaylist)
  const removeSongFromPlaylist = usePlaylistStore((s) => s.removeSongFromPlaylist)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  useEffect(() => {
    if (open) setNewPlaylistName('')
  }, [open, song?.id])

  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => b.updatedAt - a.updatedAt),
    [playlists],
  )

  if (!song) return null

  const handleToggle = (playlistId: string, alreadySaved: boolean) => {
    if (alreadySaved) {
      removeSongFromPlaylist(playlistId, song.id)
      onSavedChange?.(playlistId, 'removed')
    } else {
      addSongToPlaylist(playlistId, song.id)
      onSavedChange?.(playlistId, 'saved')
    }
    onClose()
  }

  const handleCreate = () => {
    const playlistId = createPlaylist(newPlaylistName)
    if (!playlistId) return
    addSongToPlaylist(playlistId, song.id)
    onSavedChange?.(playlistId, 'saved')
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Save "${song.title}"`}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-secondary">
          Choose a collection for this chart. Tap an existing one again to remove it.
        </p>

        <div className="flex flex-col gap-2">
          {sortedPlaylists.map((playlist) => {
            const alreadySaved = playlist.songIds.includes(song.id)

            return (
              <button
                key={playlist.id}
                type="button"
                onClick={() => handleToggle(playlist.id, alreadySaved)}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-4 py-3 text-left transition-colors hover:border-border-hover"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{playlist.title}</p>
                  <p className="text-xs text-text-secondary">{playlist.songIds.length} charts</p>
                </div>
                <span className="text-xs font-medium text-text-secondary">
                  {alreadySaved ? 'Remove chart' : 'Add chart'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex flex-col gap-3">
            <Input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="New collection name"
            />
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!newPlaylistName.trim()}
            >
              Create collection and save
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
