import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'

export interface PipelineStep {
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export interface PipelineStepsProps {
  steps: PipelineStep[]
  activeIndex: number
  status: 'running' | 'success' | 'error'
  className?: string
}

export function PipelineSteps({ steps, activeIndex, status, className }: PipelineStepsProps) {
  const resolvedActive = status === 'success' ? steps.length - 1 : status === 'error' ? activeIndex : activeIndex

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {steps.map((step, index) => {
        const isDone = index < resolvedActive || status === 'success'
        const isActive = index === resolvedActive && status !== 'success'
        const isPending = index > resolvedActive && status !== 'success'
        const isError = index === resolvedActive && status === 'error'

        return (
          <div key={step.label} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isDone && 'border-text-primary bg-text-primary text-surface-0',
                  isActive && !isError && 'border-text-primary text-text-primary',
                  isError && 'border-error bg-error/10 text-error',
                  isPending && 'border-border text-text-muted',
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" />
                ) : isActive && !isError ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <step.icon className="size-3.5" />
                )}
              </div>
              <span
                className={cn(
                  'hidden text-[13px] leading-none sm:block',
                  isDone && 'font-medium text-text-primary',
                  isActive && 'font-medium text-text-primary',
                  isError && 'font-medium text-error',
                  isPending && 'text-text-muted',
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-px flex-1 min-w-[12px] transition-colors',
                  index < resolvedActive ? 'bg-text-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
