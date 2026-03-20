import { Home, Library, Music } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/jam', icon: Music, label: 'Play' },
  { to: '/library', icon: Library, label: 'My Library' },
]
