import { Home, FolderOpen, Music, FilePlus2, Settings, Search, CalendarDays } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/tools', icon: Music, label: 'Tools' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/projects', icon: FolderOpen, label: 'My Library' },
]

// Separate action entry — displayed below a divider in the sidebar
export const NEW_SHEET_ITEM = { to: '/editor', icon: FilePlus2, label: 'New Chart' }

export const SETTINGS_ITEM = { to: '/settings', icon: Settings, label: 'Settings' }
