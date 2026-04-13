import { FileAudio, FileMusic, FileText, X } from 'lucide-react'
import { cn } from '@/components/ui/utils'

type FileCategory = 'gp' | 'musicxml' | 'audio' | 'pdf-image'

const BADGE_CONFIG: Record<FileCategory, { label: string; icon: typeof FileMusic }> = {
  gp: { label: 'Guitar Pro', icon: FileMusic },
  musicxml: { label: 'MusicXML', icon: FileMusic },
  audio: { label: 'Audio', icon: FileAudio },
  'pdf-image': { label: 'PDF / Image', icon: FileText },
}

interface FileUploadChipProps {
  fileName: string
  fileCategory: FileCategory
  status?: 'idle' | 'importing' | 'imported' | 'error'
  statusMessage?: string
  onRemove: () => void
  className?: string
}

export function FileUploadChip({
  fileName,
  fileCategory,
  status = 'idle',
  statusMessage,
  onRemove,
  className,
}: FileUploadChipProps) {
  const badge = BADGE_CONFIG[fileCategory]
  const Icon = badge.icon

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-[#f7f6f3] px-4 py-3',
        status === 'error' && 'bg-[#fef2f2]',
        className,
      )}
    >
      <Icon size={18} className={cn('shrink-0', status === 'error' ? 'text-[#b24d37]' : 'text-[#737373]')} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#111111]">{fileName}</p>
        <p className={cn(
          'text-[11px]',
          status === 'error' ? 'text-[#b24d37]' : 'text-[#8a8a8a]',
        )}>
          {statusMessage ?? badge.label}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove file"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8a8a8a] transition-colors hover:bg-[#e9e7e2] hover:text-[#111111]"
      >
        <X size={14} />
      </button>
    </div>
  )
}
