import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/components/ui/utils'

export function AppShell() {
  const agentPanelOpen = useUIStore((s) => s.agentPanelOpen)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-1">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main
          className={cn(
            'flex-1 overflow-hidden transition-all duration-200',
            agentPanelOpen ? 'mr-[360px]' : 'mr-0',
          )}
        >
          <div className="h-full overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <AgentPanel />
    </div>
  )
}
