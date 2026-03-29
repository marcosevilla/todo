import { useCallback, useEffect, useState } from 'react'
import { getSetting, setSetting } from '@/services/tauri'

type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)

  root.classList.toggle('dark', isDark)
  localStorage.setItem('theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system'
  })

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    try {
      await setSetting('theme', newTheme)
    } catch {
      // Silently fail — localStorage is the fallback
    }
  }, [])

  // On mount: read from SQLite, apply
  useEffect(() => {
    getSetting('theme').then((stored) => {
      const t = (stored as Theme) || 'system'
      setThemeState(t)
      applyTheme(t)
    }).catch(() => {
      applyTheme('system')
    })
  }, [])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return { theme, setTheme }
}
