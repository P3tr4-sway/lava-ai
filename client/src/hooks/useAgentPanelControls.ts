import { useCallback } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useIsMobile } from './useIsMobile'

export function useAgentPanelControls() {
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const desktopMode = useUIStore((s) => s.agentPanelDesktopMode)
  const mobileOpen = useUIStore((s) => s.agentPanelMobileOpen)
  const expandAgentPanel = useUIStore((s) => s.expandAgentPanel)
  const collapseAgentPanel = useUIStore((s) => s.collapseAgentPanel)
  const toggleDesktopAgentPanel = useUIStore((s) => s.toggleDesktopAgentPanel)
  const openMobileAgentPanel = useUIStore((s) => s.openMobileAgentPanel)
  const closeMobileAgentPanel = useUIStore((s) => s.closeMobileAgentPanel)
  const canShowPanel = Boolean(
    matchPath('/play/:id', pathname) ||
    matchPath('/learn/songs/:id', pathname) ||
    matchPath('/tools/new', pathname) ||
    matchPath('/editor', pathname) ||
    matchPath('/editor/:id', pathname),
  )

  const showPanel = useCallback(() => {
    if (!canShowPanel) return
    if (isMobile) {
      openMobileAgentPanel()
      return
    }
    expandAgentPanel()
  }, [canShowPanel, expandAgentPanel, isMobile, openMobileAgentPanel])

  const hidePanel = useCallback(() => {
    if (!canShowPanel) return
    if (isMobile) {
      closeMobileAgentPanel()
      return
    }
    collapseAgentPanel()
  }, [canShowPanel, closeMobileAgentPanel, collapseAgentPanel, isMobile])

  const togglePanel = useCallback(() => {
    if (!canShowPanel) return
    if (isMobile) {
      if (mobileOpen) {
        closeMobileAgentPanel()
        return
      }
      openMobileAgentPanel()
      return
    }
    toggleDesktopAgentPanel()
  }, [canShowPanel, closeMobileAgentPanel, isMobile, mobileOpen, openMobileAgentPanel, toggleDesktopAgentPanel])

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
