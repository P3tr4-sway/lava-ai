import { useCallback, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { useIsMobile } from './useIsMobile'

export function useAgentPanelControls() {
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const [desktopMode, setDesktopMode] = useState<'expanded' | 'collapsed'>('expanded')
  const [mobileOpen, setMobileOpen] = useState(false)

  const canShowPanel = Boolean(
    matchPath('/pack/:id', pathname) ||
    matchPath('/play/:id', pathname) ||
    matchPath('/editor', pathname) ||
    matchPath('/editor/:id', pathname),
  )

  const showPanel = useCallback(() => {
    if (!canShowPanel) return
    if (isMobile) {
      setMobileOpen(true)
      return
    }
    setDesktopMode('expanded')
  }, [canShowPanel, isMobile])

  const hidePanel = useCallback(() => {
    if (!canShowPanel) return
    if (isMobile) {
      setMobileOpen(false)
      return
    }
    setDesktopMode('collapsed')
  }, [canShowPanel, isMobile])

  const togglePanel = useCallback(() => {
    if (!canShowPanel) return
    if (isMobile) {
      setMobileOpen((prev) => !prev)
      return
    }
    setDesktopMode((prev) => (prev === 'expanded' ? 'collapsed' : 'expanded'))
  }, [canShowPanel, isMobile])

  return {
    canShowPanel,
    isMobile,
    desktopMode,
    mobileOpen,
    isPanelVisible: canShowPanel && (isMobile ? mobileOpen : desktopMode === 'expanded'),
    showPanel,
    hidePanel,
    togglePanel,
  }
}
