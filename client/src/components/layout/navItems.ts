import { Home, BookOpen, Music, Layers, FolderOpen, Library } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/jam', icon: Music, label: 'Play' },
  { to: '/create', icon: Layers, label: 'Create' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
]
