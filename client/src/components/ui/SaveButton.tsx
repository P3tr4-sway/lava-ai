import { Save, Check } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface SaveButtonProps {
  saving: boolean
  hasContent: boolean
  isSaved: boolean
  showSavedBadge: boolean
  onSave: () => void
  className?: string
}

export function SaveButton({ saving, hasContent, isSaved, showSavedBadge, onSave, className }: SaveButtonProps) {
  return (
    <button
      onClick={onSave}
      disabled={saving || !hasContent || isSaved}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
        showSavedBadge
          ? 'bg-success/10 text-success border border-success/20'
          : hasContent && !isSaved
            ? 'bg-surface-2 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover'
            : 'bg-surface-2 border border-border text-text-muted opacity-40 cursor-not-allowed',
        className,
      )}
    >
      {showSavedBadge ? (
        <><Check size={13} /> Saved</>
      ) : saving ? (
        'Saving...'
      ) : (
        <><Save size={13} /> Save</>
      )}
    </button>
  )
}
