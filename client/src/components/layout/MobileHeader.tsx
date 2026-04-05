import { Link } from 'react-router-dom'
import { LavaLogo } from './LavaLogo'
import { TopRightUtilityBar } from './TopRightUtilityBar'

export function MobileHeader({ hideUtilityAuxiliary = false }: { hideUtilityAuxiliary?: boolean }) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface-0">
      <Link to="/">
        <LavaLogo />
      </Link>
      <TopRightUtilityBar compact embedded hideAuxiliary={hideUtilityAuxiliary} className="ml-auto" />
    </header>
  )
}
