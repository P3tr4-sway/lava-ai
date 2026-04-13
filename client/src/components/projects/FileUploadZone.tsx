import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/components/ui/utils'

const ACCEPT =
  '.gp,.gp4,.gp5,.gpx,.gp7,.musicxml,.mxl,.xml,.pdf,.jpg,.jpeg,.png,audio/*'

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
  className?: string
}

export function FileUploadZone({ onFileSelect, disabled, className }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file) onFileSelect(file)
    },
    [disabled, onFileSelect],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) {
        e.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }
    },
    [disabled],
  )

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFileSelect(file)
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [onFileSelect],
  )

  return (
    <button
      type="button"
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      disabled={disabled}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors',
        dragOver
          ? 'border-[#111111] bg-[#f3f2ee]'
          : 'border-[#d9d9d9] bg-[#fafaf8] hover:border-[#bbbbbb] hover:bg-[#f7f6f3]',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <Upload size={20} className="text-[#8a8a8a]" />
      <div>
        <p className="text-[13px] font-medium text-[#555555]">
          Drop a file or click to browse
        </p>
        <p className="mt-0.5 text-[11px] text-[#8a8a8a]">
          GP, MusicXML, PDF, audio
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        className="hidden"
        tabIndex={-1}
      />
    </button>
  )
}
