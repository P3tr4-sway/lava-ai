import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from './utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  backdropClassName?: string
}

export function Dialog({ open, onClose, title, children, className, backdropClassName }: DialogProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className={cn('absolute inset-0 bg-black/60', backdropClassName)} onClick={onClose} />
      {/* Panel */}
      <div className={cn(
        'relative bg-surface-0 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in',
        className,
      )}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
