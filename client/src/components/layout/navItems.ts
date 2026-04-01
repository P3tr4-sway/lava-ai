import { Home, Music, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const HOME_NAV_RESET_EVENT = 'lava:home-nav-reset'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/songs', label: 'My Songs', icon: Music },
  { to: '/profile', label: 'Profile', icon: User },
]

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/songs', label: 'Songs', icon: Music },
  { to: '/profile', label: 'Profile', icon: User },
]
