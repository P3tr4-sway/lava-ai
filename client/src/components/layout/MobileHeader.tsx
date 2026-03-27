import { Link } from 'react-router-dom'
import { Menu, Bot } from 'lucide-react'
import { LavaLogo } from './LavaLogo'
import { useUIStore } from '@/stores/uiStore'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'

export function MobileHeader() {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const { canShowPanel, togglePanel } = useAgentPanelControls()

  return (
    <header className="h-14 flex items-center px-4 gap-3 bg-surface-0 border-b border-border shrink-0 sticky top-0 z-20">
      <button
        onClick={() => setSidebarOpen(true)}
        className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>
      <Link to="/" className="flex items-center gap-2 flex-1 min-w-0">
        <LavaLogo />
        <span className="text-base font-semibold tracking-wide text-text-primary">LAVA</span>
      </Link>
      {canShowPanel && (
        <button
          onClick={togglePanel}
          className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
          aria-label="AI Practice Assistant"
        >
          <Bot size={18} />
        </button>
      )}
    </header>
  )
}
