import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from './utils'

interface ToastData {
  id: string
  message: string
  type?: 'default' | 'success' | 'error'
  actionLabel?: string
  onAction?: () => void
}

interface ToastContextValue {
  toast: (
    message: string,
    type?: ToastData['type'],
    options?: { actionLabel?: string; onAction?: () => void },
  ) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const toast = useCallback((
    message: string,
    type: ToastData['type'] = 'default',
    options?: { actionLabel?: string; onAction?: () => void },
  ) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type, ...options }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} data={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ data, onDismiss }: { data: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(data.id), 3000)
    return () => clearTimeout(timer)
  }, [data.id, onDismiss])

  return (
    <div className={cn(
      'pointer-events-auto flex items-center gap-3 bg-surface-2 border border-border rounded-lg px-4 py-3 shadow-lg animate-slide-in-right min-w-[240px]',
      data.type === 'error' && 'border-error/50',
      data.type === 'success' && 'border-success/50',
    )}>
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm text-text-primary">{data.message}</p>
        {data.actionLabel && data.onAction && (
          <button
            onClick={() => {
              data.onAction?.()
              onDismiss(data.id)
            }}
            className="w-fit text-xs font-medium text-text-primary hover:text-text-secondary transition-colors"
          >
            {data.actionLabel}
          </button>
        )}
      </div>
      <button onClick={() => onDismiss(data.id)} className="text-text-muted hover:text-text-secondary shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}
