/**
 * KeyboardShortcutsPanel — Dialog showing all tab editor keyboard shortcuts.
 *
 * Triggered by Cmd+/ or a `?` button in the toolbar.
 * Two-column layout, shortcuts organized by category.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/components/ui/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShortcutEntry {
  keys: string[]
  description: string
}

interface ShortcutCategory {
  title: string
  entries: ShortcutEntry[]
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navigation',
    entries: [
      { keys: ['←', '→'], description: 'Move beat left / right' },
      { keys: ['↑', '↓'], description: 'Move string up / down' },
      { keys: ['Ctrl', '←'], description: 'Previous bar' },
      { keys: ['Ctrl', '→'], description: 'Next bar' },
      { keys: ['Home'], description: 'Go to beginning' },
      { keys: ['End'], description: 'Go to end' },
      { keys: ['Tab'], description: 'Next beat / bar' },
      { keys: ['Enter'], description: 'Confirm input' },
    ],
  },
  {
    title: 'Note input',
    entries: [
      { keys: ['0–9'], description: 'Enter fret number' },
      { keys: ['W'], description: 'Whole note' },
      { keys: ['H'], description: 'Half note' },
      { keys: ['Q'], description: 'Quarter note' },
      { keys: ['E'], description: 'Eighth note' },
      { keys: ['S'], description: 'Sixteenth note' },
      { keys: ['T'], description: '32nd note' },
      { keys: ['.'], description: 'Toggle augmentation dot' },
      { keys: ['3'], description: 'Toggle triplet' },
      { keys: ['R'], description: 'Toggle rest' },
    ],
  },
  {
    title: 'Techniques',
    entries: [
      { keys: ['H'], description: 'Hammer-on / Pull-off' },
      { keys: ['P'], description: 'Pull-off' },
      { keys: ['/'], description: 'Slide up (legato)' },
      { keys: ['\\'], description: 'Slide down' },
      { keys: ['B'], description: 'Bend' },
      { keys: ['V'], description: 'Vibrato' },
      { keys: ['~'], description: 'Harmonic (natural)' },
      { keys: ['X'], description: 'Dead note' },
      { keys: ['G'], description: 'Ghost note' },
      { keys: ['T'], description: 'Tap (left hand)' },
      { keys: ['Shift', 'P'], description: 'Palm mute' },
      { keys: ['Shift', 'L'], description: 'Let ring' },
    ],
  },
  {
    title: 'Editing',
    entries: [
      { keys: ['Backspace'], description: 'Delete note' },
      { keys: ['Delete'], description: 'Clear beat' },
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (alt)' },
      { keys: ['Ctrl', 'C'], description: 'Copy selection' },
      { keys: ['Ctrl', 'V'], description: 'Paste' },
      { keys: ['Ctrl', 'X'], description: 'Cut selection' },
      { keys: ['Ctrl', 'A'], description: 'Select all' },
    ],
  },
  {
    title: 'Playback',
    entries: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['['], description: 'Set loop start' },
      { keys: [']'], description: 'Set loop end' },
      { keys: ['L'], description: 'Toggle loop' },
      { keys: ['Ctrl', 'Home'], description: 'Back to beginning' },
    ],
  },
  {
    title: 'File',
    entries: [
      { keys: ['Ctrl', 'S'], description: 'Save / download .json' },
      { keys: ['Ctrl', 'O'], description: 'Open file' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KeyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
      {label}
    </span>
  )
}

function ShortcutRow({ entry }: { entry: ShortcutEntry }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-xs text-text-secondary">{entry.description}</span>
      <div className="flex shrink-0 items-center gap-1">
        {entry.keys.map((k, i) => (
          <KeyBadge key={i} label={k} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface KeyboardShortcutsPanelProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  // Split categories into two columns
  const half = Math.ceil(CATEGORIES.length / 2)
  const leftCols = CATEGORIES.slice(0, half)
  const rightCols = CATEGORIES.slice(half)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(96vw,760px)] -translate-x-1/2 -translate-y-1/2',
          'rounded-2xl border border-border bg-surface-0 shadow-[0_24px_60px_rgba(0,0,0,0.24)]',
          'animate-fade-in',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-text-primary">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="flex size-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body — two-column layout */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-border overflow-y-auto" style={{ maxHeight: 'min(70vh, 520px)' }}>
          {[leftCols, rightCols].map((cols, colIdx) => (
            <div key={colIdx} className="space-y-5 px-6 py-5">
              {cols.map((cat) => (
                <div key={cat.title}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                    {cat.title}
                  </p>
                  <div className="divide-y divide-border/60">
                    {cat.entries.map((entry, i) => (
                      <ShortcutRow key={i} entry={entry} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-6 py-3 text-center">
          <span className="text-[11px] text-text-muted">
            Press <KeyBadge label="?" /> or <KeyBadge label="Cmd+/" /> to toggle this panel
          </span>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Hook — wraps the open/close state and the Cmd+/ keyboard trigger
// ---------------------------------------------------------------------------

export function useKeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Cmd+/ or Ctrl+/
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      // Standalone ? (when not in an input)
      if (
        e.key === '?' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
  }
}
