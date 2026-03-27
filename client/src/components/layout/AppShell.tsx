import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { BottomNav } from './BottomNav'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { LibraryModal } from '@/components/library/LibraryModal'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { GuestWelcomeModal } from '@/components/onboarding/GuestWelcomeModal'
import { AuthPromptModal } from '@/components/auth/AuthPromptModal'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'
import { cn } from '@/components/ui/utils'
import { AudioController } from '@/audio/AudioController'
import { TaskNotifications } from '@/components/ui/TaskNotifications'
import { PracticePlanDialog } from '@/components/calendar/PracticePlanDialog'
import { ToastProvider } from '@/components/ui/Toast'
import { useTaskPoller } from '@/hooks/useTaskPoller'
import { isAgentWorkspaceEmbedded } from '@/utils/agentWorkspace'

export function AppShell() {
  useTheme()
  useTaskPoller()
  const location = useLocation()

  // Initialize AudioController once on mount — bridges Zustand stores → ToneEngine
  useEffect(() => {
    const controller = AudioController.getInstance()
    controller.init()
    return () => controller.destroy()
  }, [])

  const isMobile = useIsMobile()
  const { canShowPanel } = useAgentPanelControls()
  const agentPanelDesktopMode = useUIStore((s) => s.agentPanelDesktopMode)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const isEmbeddedWorkspace = isAgentWorkspaceEmbedded(location.search)

  if (isEmbeddedWorkspace) {
    return (
      <ToastProvider>
        <main className="h-screen w-screen overflow-hidden bg-surface-1">
          <div className="h-full overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      {isMobile ? (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-1">
          <MobileHeader />
          <Sidebar />
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-30"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <main className="flex-1 overflow-hidden min-w-0">
            <div className="h-full overflow-y-auto pb-14">
              <Outlet />
            </div>
          </main>
          <BottomNav />
          {canShowPanel && <AgentPanel />}
          <LibraryModal />
          <OnboardingModal />
          <GuestWelcomeModal />
          <AuthPromptModal />
          <TaskNotifications />
          <PracticePlanDialog />
        </div>
      ) : (
        <div className="flex h-screen w-screen overflow-hidden bg-surface-1">
          <Sidebar />
          <main className="flex-1 overflow-hidden min-w-0">
            <div className="h-full overflow-y-auto">
              <Outlet />
            </div>
          </main>
          {canShowPanel && (
            <aside
              className={cn(
                'shrink-0 h-full overflow-hidden border-l border-border bg-surface-0 transition-[width] duration-200 ease-out',
                agentPanelDesktopMode === 'expanded'
                  ? 'w-[var(--agent-panel-expanded-width)]'
                  : 'w-[var(--agent-panel-collapsed-width)]',
              )}
            >
              <AgentPanel />
            </aside>
          )}
          <TaskNotifications />
          <PracticePlanDialog />
          <LibraryModal />
          <OnboardingModal />
          <GuestWelcomeModal />
          <AuthPromptModal />
        </div>
      )}
    </ToastProvider>
  )
}
