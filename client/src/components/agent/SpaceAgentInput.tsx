import { ChatInput } from './ChatInput'
import { useAgent } from '@/hooks/useAgent'
import { useUIStore } from '@/stores/uiStore'

interface SpaceAgentInputProps {
  placeholder?: string
}

export function SpaceAgentInput({ placeholder }: SpaceAgentInputProps) {
  const { sendMessage } = useAgent()
  const setAgentPanelOpen = useUIStore((s) => s.setAgentPanelOpen)

  const handleSend = (message: string) => {
    setAgentPanelOpen(true)
    sendMessage(message)
  }

  return <ChatInput compact onSend={handleSend} placeholder={placeholder} />
}
