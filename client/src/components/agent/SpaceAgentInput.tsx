import { forwardRef } from 'react'
import { ChatInput, type ChatInputRef } from './ChatInput'
import { useAgent } from '@/hooks/useAgent'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'

export type SpaceAgentInputRef = ChatInputRef

interface SpaceAgentInputProps {
  placeholder?: string
  density?: 'default' | 'roomy'
  className?: string
}

export const SpaceAgentInput = forwardRef<SpaceAgentInputRef, SpaceAgentInputProps>(
  function SpaceAgentInput({ placeholder, density = 'default', className }, ref) {
    const { sendMessage } = useAgent()
    const { showPanel } = useAgentPanelControls()

    const handleSend = (message: string) => {
      showPanel()
      sendMessage(message)
    }

    return (
      <ChatInput
        ref={ref}
        compact
        density={density}
        onSend={handleSend}
        placeholder={placeholder}
        className={className}
      />
    )
  },
)
