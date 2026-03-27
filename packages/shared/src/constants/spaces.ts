import type { SpaceType } from '../types/agent.js'

export interface SpaceConfig {
  id: SpaceType
  label: string
  route: string
  description: string
  icon: string
}

export const SPACES: SpaceConfig[] = [
  {
    id: 'home',
    label: 'Home',
    route: '/',
    description: 'Discover songs to practice and jump into interactive score playback',
    icon: 'Home',
  },
  {
    id: 'learn',
    label: 'Learn',
    route: '/',
    description: 'Find songs to practice and continue active sessions',
    icon: 'BookOpen',
  },
  {
    id: 'jam',
    label: 'Jam',
    route: '/?tab=tools',
    description: 'Shape tone, backing tracks, and session-ready practice tools',
    icon: 'Music',
  },
  {
    id: 'tone',
    label: 'AI Tone',
    route: '/tools/new',
    description: 'Build and refine amp, cab, and effects chains with AI guidance',
    icon: 'SlidersHorizontal',
  },
  {
    id: 'create',
    label: 'Create',
    route: '/editor',
    description: 'Write and refine your own interactive practice sheets',
    icon: 'Layers',
  },
  {
    id: 'tools',
    label: 'Tools',
    route: '/?tab=tools',
    description: 'Practice utilities like tone shaping, backing tracks, and recording support',
    icon: 'Wrench',
  },
  {
    id: 'library',
    label: 'Files',
    route: '/files',
    description: 'Open your chord charts, backing tracks, and effects presets',
    icon: 'Library',
  },
  {
    id: 'projects',
    label: 'Projects',
    route: '/projects',
    description: 'Open your saved projects, collections, and recordings',
    icon: 'FolderOpen',
  },
]

export const SPACE_ROUTES: Record<SpaceType, string> = {
  home: '/',
  learn: '/',
  jam: '/?tab=tools',
  tone: '/tools/new',
  create: '/editor',
  tools: '/?tab=tools',
  library: '/files',
  projects: '/projects',
}
