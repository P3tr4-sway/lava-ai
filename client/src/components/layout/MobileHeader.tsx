// client/src/components/layout/MobileHeader.tsx
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { LavaLogo } from './LavaLogo'

export function MobileHeader() {
  return (
    <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-surface-0">
      <button
        className="flex items-center justify-center size-8 text-text-secondary"
        aria-label="Menu"
      >
        <Menu className="size-5" />
      </button>
      <Link to="/">
        <LavaLogo />
      </Link>
      <div className="size-8" /> {/* Spacer for symmetry */}
    </header>
  )
}
