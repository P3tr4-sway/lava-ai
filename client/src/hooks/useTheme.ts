import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'

function applyTheme(theme: string) {
  const html = document.documentElement
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.setAttribute('data-theme', dark ? 'dark' : 'light')
  } else {
    html.setAttribute('data-theme', theme)
  }
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  useEffect(() => {
    applyTheme(theme)

    if (theme !== 'system') return

    // For system mode, follow OS changes in real-time
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return { theme, setTheme }
}
