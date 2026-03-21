import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { BottomNav } from './BottomNav'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { LibraryModal } from '@/components/library/LibraryModal'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/components/ui/utils'
import { Bot } from 'lucide-react'
import { AudioController } from '@/audio/AudioController'

export function AppShell() {
  useTheme()

  // Initialize AudioController once on mount — bridges Zustand stores → ToneEngine
  useEffect(() => {
    const controller = AudioController.getInstance()
    controller.init()
    return () => controller.destroy()
  }, [])

  const isMobile = useIsMobile()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const agentPanelOpen = useUIStore((s) => s.agentPanelOpen)
  const toggleAgentPanel = useUIStore((s) => s.toggleAgentPanel)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-1">
        <MobileHeader />
        <Sidebar />

        {/* Backdrop for sidebar drawer */}
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

        {/* Agent panel — only on space pages */}
        {!isHome && <AgentPanel />}

        <LibraryModal />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-1">
      <Sidebar />
      <main className="flex-1 overflow-hidden min-w-0">
        <div className="h-full overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Floating agent toggle — only on space pages, not home; hidden when popup is open */}
      {!isHome && (
        <button
          onClick={toggleAgentPanel}
          title="AI Agent"
          className={cn(
            'fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-150',
            'bg-surface-3 text-text-secondary hover:bg-surface-4 hover:text-text-primary',
            agentPanelOpen && 'opacity-0 pointer-events-none scale-75',
          )}
        >
          <Bot size={20} />
        </button>
      )}

      {/* Floating agent popup — only on space pages */}
      {!isHome && <AgentPanel />}

      <LibraryModal />
    </div>
  )
}
