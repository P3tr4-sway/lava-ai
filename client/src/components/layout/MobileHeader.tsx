import { Link } from 'react-router-dom'
import { LavaLogo } from './LavaLogo'

export function MobileHeader() {
  return (
    <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-surface-0">
      <div className="size-8" />
      <Link to="/">
        <LavaLogo />
      </Link>
      <div className="size-8" />
    </header>
  )
}
