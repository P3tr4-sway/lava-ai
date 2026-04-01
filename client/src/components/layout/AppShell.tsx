import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { BottomNav } from './BottomNav'
import { ToastProvider, TaskNotifications } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { AudioController } from '@/audio/AudioController'

export function AppShell() {
  useTheme()
  const isMobile = useIsMobile()

  useEffect(() => {
    const controller = AudioController.getInstance()
    controller.init()
    return () => controller.destroy()
  }, [])

  if (isMobile) {
    return (
      <ToastProvider>
        <div className="flex flex-col h-dvh bg-surface-0">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
          <BottomNav />
        </div>
        <TaskNotifications />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="flex h-dvh bg-surface-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <TaskNotifications />
    </ToastProvider>
  )
}
