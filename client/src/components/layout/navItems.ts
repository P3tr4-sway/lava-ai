import { Home, FolderOpen, Settings, Search } from 'lucide-react'

export const HOME_NAV_RESET_EVENT = 'lava:home-nav-reset'
export const HOME_SECTION_QUERY_PARAM = 'tab'
export const DEFAULT_HOME_SECTION = 'songs'

export type HomeSectionId = 'songs' | 'playlists' | 'tools' | 'agent'

interface HomeSectionItem {
  id: HomeSectionId
  label: string
  to: string
}

export const HOME_SECTION_ITEMS: HomeSectionItem[] = [
  { id: 'songs', label: 'Songs', to: '/?tab=songs' },
  { id: 'tools', label: 'Tools', to: '/?tab=tools' },
  { id: 'agent', label: 'Agent', to: '/?tab=agent' },
]

export function isHomeSectionId(value: string | null): value is HomeSectionId {
  return value === 'songs' || value === 'playlists' || value === 'tools' || value === 'agent'
}

export function getHomeSectionFromSearch(search: string | URLSearchParams): HomeSectionId {
  const searchParams = typeof search === 'string' ? new URLSearchParams(search) : search
  const section = searchParams.get(HOME_SECTION_QUERY_PARAM)
  return isHomeSectionId(section) ? section : DEFAULT_HOME_SECTION
}

export const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/files', icon: FolderOpen, label: 'Files' },
]

export const SETTINGS_ITEM = { to: '/settings', icon: Settings, label: 'Settings' }
