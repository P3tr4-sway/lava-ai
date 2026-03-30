import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { PracticeSurface } from './PracticeSurface'
import { StaffPreview } from './StaffPreview'

interface EditorCanvasProps {
  className?: string
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const viewMode = useEditorStore((state) => state.viewMode)
  const tabSurface = <PracticeSurface className="min-h-0" />

  return (
    <div className={cn('grid min-h-0 w-full flex-1 gap-5 overflow-hidden px-5 pb-24 pt-4', className)}>
      {viewMode === 'staff' && <StaffPreview className="min-h-0" />}
      {viewMode === 'tab' && tabSurface}
      {viewMode === 'leadSheet' && <StaffPreview className="min-h-0" />}
      {viewMode === 'split' && (
        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <StaffPreview className="min-h-0" />
          <PracticeSurface className="min-h-0" compact />
        </div>
      )}
    </div>
  )
}
