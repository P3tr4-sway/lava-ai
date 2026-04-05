import { X } from 'lucide-react'

interface PackReadyBarProps {
  onClose: () => void
}

export function PackReadyBar({
  onClose,
}: PackReadyBarProps) {
  return (
    <div className="border-b border-border bg-surface-0 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Version ready</p>
          <p className="text-sm text-text-secondary">Use the version picker near save to switch.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface-0 text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
