import { AlertTriangle } from 'lucide-react'

interface UnsavedChangesDialogProps {
  blocker: { state: string; reset?: () => void; proceed?: () => void }
  onSave: () => void
  saving: boolean
  message?: string
}

export function UnsavedChangesDialog({ blocker, onSave, saving, message }: UnsavedChangesDialogProps) {
  if (blocker.state !== 'blocked') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => blocker.reset?.()}
      />
      <div className="relative z-10 w-full max-w-sm mx-4 bg-surface-1 border border-border rounded-lg shadow-xl animate-fade-in">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center mt-0.5">
              <AlertTriangle size={16} className="text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Unsaved changes</p>
              <p className="text-xs text-text-secondary mt-1">
                {message ?? 'You have unsaved changes. Save before leaving?'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => blocker.reset?.()}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => blocker.proceed?.()}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-border transition-colors"
            >
              Don't Save
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text-primary text-surface-0 hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
