import { useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { useAgentStore } from '@/stores/agentStore'
import { Card } from '@/components/ui/Card'
import { FilesContent } from '@/components/library/FilesContent'

export function LibraryPage() {
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'library', projectId: undefined })
  }, [setSpaceContext])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <FolderOpen size={20} className="text-text-secondary" />
          <h1 className="text-xl font-semibold">Files</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Chord charts, tracks, and presets.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <FilesContent />
      </Card>
    </div>
  )
}
