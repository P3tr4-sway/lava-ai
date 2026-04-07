import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { BottomNav } from './BottomNav'
import { TopRightUtilityBar } from './TopRightUtilityBar'
import { ToastProvider } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { AudioController } from '@/audio/AudioController'

export function AppShell() {
  useTheme()
  const isMobile = useIsMobile()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [hideUtilityAuxiliary, setHideUtilityAuxiliary] = useState(false)

  useEffect(() => {
    const controller = AudioController.getInstance()
    controller.init()
    return () => controller.destroy()
  }, [])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    const shouldTrack = location.pathname === '/'
    if (!shouldTrack) {
      setHideUtilityAuxiliary(false)
      return
    }

    const updateVisibility = () => {
      setHideUtilityAuxiliary(main.scrollTop > 24)
    }

    updateVisibility()
    main.addEventListener('scroll', updateVisibility, { passive: true })

    return () => main.removeEventListener('scroll', updateVisibility)
  }, [location.pathname])

  if (isMobile) {
    return (
      <ToastProvider>
        <div className="flex flex-col h-dvh bg-surface-0">
          <MobileHeader hideUtilityAuxiliary={hideUtilityAuxiliary} />
          <main ref={mainRef} className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="relative h-dvh bg-surface-0">
        <Sidebar />
        <TopRightUtilityBar
          hideAuxiliary={hideUtilityAuxiliary}
          className="fixed right-5 top-4 z-40"
        />
        <main
          ref={mainRef}
          className="ml-24 h-dvh w-[calc(100%-6rem)] min-w-0 overflow-y-auto"
        >
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  )
}
