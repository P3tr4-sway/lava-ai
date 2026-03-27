import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PlaylistItem {
  id: string
  title: string
  songIds: string[]
  createdAt: number
  updatedAt: number
}

interface PlaylistStore {
  playlists: PlaylistItem[]
  selectedPlaylistId: string | null
  createPlaylist: (title: string) => string
  addSongToPlaylist: (playlistId: string, songId: string) => void
  setSelectedPlaylist: (id: string | null) => void
  renamePlaylist: (playlistId: string, title: string) => void
  deletePlaylist: (playlistId: string) => void
  removeSongFromPlaylist: (playlistId: string, songId: string) => void
}

const SEEDED_AT = Date.now()

const DEFAULT_PLAYLISTS: PlaylistItem[] = [
  {
    id: 'recently-saved',
    title: 'Recently Saved',
    songIds: ['wonderwall', 'wish-you-were-here', 'let-her-go'],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: 'starter-pack',
    title: 'Beginner Starter Pack',
    songIds: ['2', '4', 'wonderwall'],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: 'acoustic-night',
    title: 'Acoustic Night',
    songIds: ['wish-you-were-here', 'anjo-de-mim', 'hotel-california'],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
]

function createPlaylistId() {
  return `playlist_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
}

export const usePlaylistStore = create<PlaylistStore>()(
  persist(
    (set) => ({
      playlists: DEFAULT_PLAYLISTS,
      selectedPlaylistId: DEFAULT_PLAYLISTS[0]?.id ?? null,

      createPlaylist: (title) => {
        const trimmed = title.trim()
        if (!trimmed) return ''

        const playlistId = createPlaylistId()
        const now = Date.now()

        set((state) => ({
          playlists: [
            {
              id: playlistId,
              title: trimmed,
              songIds: [],
              createdAt: now,
              updatedAt: now,
            },
            ...state.playlists,
          ],
          selectedPlaylistId: playlistId,
        }))

        return playlistId
      },

      addSongToPlaylist: (playlistId, songId) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist
            if (playlist.songIds.includes(songId)) return playlist

            return {
              ...playlist,
              songIds: [songId, ...playlist.songIds],
              updatedAt: Date.now(),
            }
          }),
          selectedPlaylistId: playlistId,
        })),

      setSelectedPlaylist: (id) => set({ selectedPlaylistId: id }),

      renamePlaylist: (playlistId, title) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist
            const trimmed = title.trim()
            if (!trimmed || trimmed === playlist.title) return playlist
            return {
              ...playlist,
              title: trimmed,
              updatedAt: Date.now(),
            }
          }),
        })),

      deletePlaylist: (playlistId) =>
        set((state) => {
          const playlists = state.playlists.filter((playlist) => playlist.id !== playlistId)
          const nextSelected =
            state.selectedPlaylistId === playlistId ? (playlists[0]?.id ?? null) : state.selectedPlaylistId

          return {
            playlists,
            selectedPlaylistId: nextSelected,
          }
        }),

      removeSongFromPlaylist: (playlistId, songId) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist
            if (!playlist.songIds.includes(songId)) return playlist
            return {
              ...playlist,
              songIds: playlist.songIds.filter((id) => id !== songId),
              updatedAt: Date.now(),
            }
          }),
        })),
    }),
    { name: 'lava-playlists' },
  ),
)
