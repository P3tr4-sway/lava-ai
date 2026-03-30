import { TabCanvas } from './TabCanvas'

interface PracticeSurfaceProps {
  className?: string
  compact?: boolean
}

export function PracticeSurface({ className, compact = false }: PracticeSurfaceProps) {
  return <TabCanvas className={className} compact={compact} />
}
