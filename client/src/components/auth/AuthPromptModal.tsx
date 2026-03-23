import { useNavigate } from 'react-router-dom'
import { Dialog, Button } from '@/components/ui'
import { LavaLogo } from '@/components/layout/LavaLogo'
import { useUIStore } from '@/stores/uiStore'

export function AuthPromptModal() {
  const open = useUIStore((s) => s.authPromptOpen)
  const action = useUIStore((s) => s.authPromptAction)
  const close = useUIStore((s) => s.closeAuthPrompt)
  const navigate = useNavigate()

  return (
    <Dialog open={open} onClose={close}>
      <div className="flex flex-col items-center text-center gap-5">
        <LavaLogo />
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-1.5">
            {action ? `Sign up to use ${action}` : 'Sign up to unlock this feature'}
          </h2>
          <p className="text-sm text-text-secondary">
            Create a free LAVA account to generate AI scores, save projects, and more
          </p>
        </div>
        <div className="flex flex-col gap-2.5 w-full">
          <Button
            className="w-full"
            onClick={() => { close(); navigate('/signup') }}
          >
            Sign Up Free
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => { close(); navigate('/login') }}
          >
            Already have an account? Sign In
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
