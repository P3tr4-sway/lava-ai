import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/components/ui/utils'
import { Bot } from 'lucide-react'

export function AppShell() {
  useTheme()

  const location = useLocation()
  const isHome = location.pathname === '/'
  const agentPanelOpen = useUIStore((s) => s.agentPanelOpen)
  const toggleAgentPanel = useUIStore((s) => s.toggleAgentPanel)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-1">
      <Sidebar />
      <main
        className={cn(
          'flex-1 overflow-hidden transition-all duration-200 min-w-0',
          !isHome && agentPanelOpen ? 'mr-[360px]' : 'mr-0',
        )}
      >
        <div className="h-full overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Floating agent toggle — only on space pages, not home */}
      {!isHome && (
        <button
          onClick={toggleAgentPanel}
          title="AI Agent"
          className={cn(
            'fixed bottom-6 z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
            agentPanelOpen
              ? 'right-[376px] bg-text-primary text-surface-0'
              : 'right-6 bg-surface-3 text-text-secondary hover:bg-surface-4 hover:text-text-primary',
          )}
        >
          <Bot size={20} />
        </button>
      )}

      {/* Agent panel — only on space pages */}
      {!isHome && <AgentPanel />}
    </div>
  )
}
