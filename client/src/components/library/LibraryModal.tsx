import { useEffect, useRef } from 'react'
import { X, Library } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { LibraryContent } from './LibraryContent'

export const LIBRARY_MODAL_ID = 'library'

export function LibraryModal() {
  const activeModal = useUIStore((s) => s.activeModal)
  const closeModal = useUIStore((s) => s.closeModal)
  const backdropRef = useRef<HTMLDivElement>(null)

  const isOpen = activeModal === LIBRARY_MODAL_ID

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeModal])

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && closeModal()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-2xl bg-surface-1 border border-border rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Library size={18} className="text-text-secondary" />
            <h2 className="text-base font-semibold">Library</h2>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <LibraryContent onSelect={closeModal} />
        </div>
      </div>
    </div>
  )
}
