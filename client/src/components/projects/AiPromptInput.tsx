import { Sparkles } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface AiPromptInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function AiPromptInput({
  value,
  onChange,
  placeholder = 'Describe how the music should change...',
  disabled,
  className,
}: AiPromptInputProps) {
  return (
    <section className={cn('rounded-2xl bg-[#f7f6f3] px-4 py-3', className)}>
      <div className="flex items-center gap-1.5">
        <Sparkles size={12} className="text-[#737373]" />
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#737373]">
          AI Stylize
        </p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="mt-1.5 w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-[1.5] text-[#111111] outline-none placeholder:text-[#a3a3a3] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </section>
  )
}
