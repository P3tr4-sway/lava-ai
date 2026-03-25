import { forwardRef } from 'react'
import { ChatInput, type ChatInputRef } from './ChatInput'
import { useAgent } from '@/hooks/useAgent'
import { useUIStore } from '@/stores/uiStore'

export type SpaceAgentInputRef = ChatInputRef

interface SpaceAgentInputProps {
  placeholder?: string
}

export const SpaceAgentInput = forwardRef<SpaceAgentInputRef, SpaceAgentInputProps>(
  function SpaceAgentInput({ placeholder }, ref) {
    const { sendMessage } = useAgent()
    const setAgentPanelOpen = useUIStore((s) => s.setAgentPanelOpen)

    const handleSend = (message: string) => {
      setAgentPanelOpen(true)
      sendMessage(message)
    }

    return <ChatInput ref={ref} compact onSend={handleSend} placeholder={placeholder} />
  },
)
