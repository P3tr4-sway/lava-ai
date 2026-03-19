import { useEffect } from 'react'
import { Library } from 'lucide-react'
import { useAgentStore } from '@/stores/agentStore'
import { Card } from '@/components/ui/Card'
import { LibraryContent } from '@/components/library/LibraryContent'

export function LibraryPage() {
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'library', projectId: undefined })
  }, [setSpaceContext])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Library size={20} className="text-text-secondary" />
          <h1 className="text-xl font-semibold">Library</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Browse drum grooves, melodic loops, backing tracks, and AI-generated content.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <LibraryContent />
      </Card>
    </div>
  )
}
