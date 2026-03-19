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
    id: 'learn',
    label: 'Learn',
    route: '/learn',
    description: 'Upload audio, transcribe music, and practice along',
    icon: 'BookOpen',
  },
  {
    id: 'jam',
    label: 'Jam',
    route: '/jam',
    description: 'Free-form play with AI-generated backing tracks',
    icon: 'Music',
  },
  {
    id: 'create',
    label: 'Create',
    route: '/create',
    description: 'Compose and arrange with AI assistance',
    icon: 'Layers',
  },
  {
    id: 'tools',
    label: 'Tools',
    route: '/tools',
    description: 'Standalone AI music tools',
    icon: 'Wrench',
  },
  {
    id: 'library',
    label: 'Library',
    route: '/library',
    description: 'Browse drum grooves, melodic loops, backing tracks, and AI generations',
    icon: 'Library',
  },
  {
    id: 'projects',
    label: 'Projects',
    route: '/projects',
    description: 'Your saved projects',
    icon: 'FolderOpen',
  },
]

export const SPACE_ROUTES: Record<SpaceType, string> = {
  learn: '/learn',
  jam: '/jam',
  create: '/create',
  tools: '/tools',
  library: '/library',
  projects: '/projects',
}
