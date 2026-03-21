import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from './utils'

interface TabsContextValue {
  active: string
  setActive: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>')
  return ctx
}

interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const active = value ?? internalValue
  const setActive = onValueChange ?? setInternalValue

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-0.5 bg-surface-2 border border-border rounded p-0.5', className)}>
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { active, setActive } = useTabs()
  return (
    <button
      onClick={() => setActive(value)}
      className={cn(
        'flex-1 px-3 py-1 text-sm rounded transition-colors whitespace-nowrap',
        active === value
          ? 'bg-surface-4 text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { active } = useTabs()
  if (active !== value) return null
  return <div className={cn('mt-4', className)}>{children}</div>
}
