import { Home, Library, Music, FilePlus2 } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/jam', icon: Music, label: 'Play' },
  { to: '/library', icon: Library, label: 'My Library' },
]

// Separate action entry — displayed below a divider in the sidebar
export const NEW_SHEET_ITEM = { to: '/editor', icon: FilePlus2, label: 'New Sheet' }
