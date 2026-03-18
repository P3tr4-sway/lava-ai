import { cn } from './utils'
import type { InputHTMLAttributes } from 'react'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export function Slider({ className, label, id, ...props }: SliderProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        type="range"
        className={cn(
          'w-full h-1 appearance-none rounded cursor-pointer',
          'bg-surface-4 accent-white',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
          className,
        )}
        {...props}
      />
    </div>
  )
}
