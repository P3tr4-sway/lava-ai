import { cn } from '@/components/ui/utils'
import type { Duration } from '@/editor/ast/types'

// ---------------------------------------------------------------------------
// NoteSvg — inline SVG note icons for toolbar buttons
// Uses currentColor so icons inherit button text color
// ---------------------------------------------------------------------------

interface NoteSvgProps {
  duration: Duration
  className?: string
}

/** 20×28 viewBox, stem on right side, flags going up */
export function NoteSvg({ duration, className }: NoteSvgProps) {
  return (
    <svg
      viewBox="0 0 20 28"
      className={cn('select-none', className)}
      width="20"
      height="28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {duration === 1 && <WholeNote />}
      {duration === 2 && <HalfNote />}
      {duration === 4 && <QuarterNote />}
      {duration === 8 && <EighthNote />}
      {duration === 16 && <SixteenthNote />}
      {duration === 32 && <ThirtySecondNote />}
    </svg>
  )
}

/* ── Note heads ── */

/** Open oval, no stem (whole note) */
function WholeNote() {
  return (
    <ellipse cx="9" cy="22" rx="5.5" ry="3.8" stroke="currentColor" strokeWidth="1.4" fill="none" />
  )
}

/** Open oval + stem (half note) */
function HalfNote() {
  return (
    <>
      <ellipse cx="9" cy="22" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <line x1="14" y1="22" x2="14" y2="5" stroke="currentColor" strokeWidth="1.4" />
    </>
  )
}

/** Filled oval + stem (quarter note) */
function QuarterNote() {
  return (
    <>
      <ellipse cx="9" cy="22" rx="4.5" ry="3.2" fill="currentColor" />
      <line x1="13.5" y1="22" x2="13.5" y2="5" stroke="currentColor" strokeWidth="1.4" />
    </>
  )
}

/** Filled oval + stem + 1 flag (8th note) */
function EighthNote() {
  return (
    <>
      <ellipse cx="9" cy="22" rx="4.5" ry="3.2" fill="currentColor" />
      <line x1="13.5" y1="22" x2="13.5" y2="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 5 C13.5 5 18 8 16 13 C15 15.5 13.5 15 13.5 12" fill="currentColor" />
    </>
  )
}

/** Filled oval + stem + 2 flags (16th note) */
function SixteenthNote() {
  return (
    <>
      <ellipse cx="9" cy="22" rx="4.5" ry="3.2" fill="currentColor" />
      <line x1="13.5" y1="22" x2="13.5" y2="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 3 C13.5 3 18 6 16 11 C15 13.5 13.5 13 13.5 10" fill="currentColor" />
      <path d="M13.5 7 C13.5 7 18 10 16 15 C15 17 13.5 16.5 13.5 14" fill="currentColor" />
    </>
  )
}

/** Filled oval + stem + 3 flags (32nd note) */
function ThirtySecondNote() {
  return (
    <>
      <ellipse cx="9" cy="22" rx="4.5" ry="3.2" fill="currentColor" />
      <line x1="13.5" y1="22" x2="13.5" y2="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 1 C13.5 1 18 4 16 9 C15 11.5 13.5 11 13.5 8" fill="currentColor" />
      <path d="M13.5 5 C13.5 5 18 8 16 13 C15 15 13.5 14.5 13.5 12" fill="currentColor" />
      <path d="M13.5 9 C13.5 9 18 12 16 17 C15 19 13.5 18.5 13.5 16" fill="currentColor" />
    </>
  )
}

// ---------------------------------------------------------------------------
// DotSvg — augmentation dot
// ---------------------------------------------------------------------------

export function DotSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={className} width="8" height="8" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// RestSvg — quarter rest
// ---------------------------------------------------------------------------

export function RestSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 24" className={className} width="12" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4 L10 8 L4 12 L10 16 L4 20 L2 18 L8 14 L2 10 L8 6 Z" />
    </svg>
  )
}
