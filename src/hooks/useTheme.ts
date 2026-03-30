import { useCallback, useEffect, useState } from 'react'
import { getSetting, setSetting } from '@/services/tauri'

type Mode = 'light' | 'dark' | 'system'
export type AccentTheme = 'warm' | 'ocean' | 'rose' | 'mono' | 'forest'

const ACCENT_THEMES: AccentTheme[] = ['warm', 'ocean', 'rose', 'mono', 'forest']

function applyMode(mode: Mode) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)

  root.classList.toggle('dark', isDark)
  localStorage.setItem('theme', mode)
}

function applyAccent(accent: AccentTheme) {
  const root = document.documentElement

  // Remove all theme classes, add the active one
  for (const t of ACCENT_THEMES) {
    root.classList.remove(`theme-${t}`)
  }
  root.classList.add(`theme-${accent}`)
  localStorage.setItem('accent_theme', accent)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Mode>(() => {
    return (localStorage.getItem('theme') as Mode) || 'system'
  })

  const [accent, setAccentState] = useState<AccentTheme>(() => {
    return (localStorage.getItem('accent_theme') as AccentTheme) || 'warm'
  })

  const setTheme = useCallback(async (newTheme: Mode) => {
    setThemeState(newTheme)
    applyMode(newTheme)
    try {
      await setSetting('theme', newTheme)
    } catch {
      // Silently fail — localStorage is the fallback
    }
  }, [])

  const setAccent = useCallback(async (newAccent: AccentTheme) => {
    setAccentState(newAccent)
    applyAccent(newAccent)
    try {
      await setSetting('accent_theme', newAccent)
    } catch {
      // Silently fail — localStorage is the fallback
    }
  }, [])

  // On mount: read from SQLite, apply
  useEffect(() => {
    Promise.all([
      getSetting('theme'),
      getSetting('accent_theme'),
    ]).then(([storedMode, storedAccent]) => {
      const m = (storedMode as Mode) || 'system'
      const a = (storedAccent as AccentTheme) || 'warm'
      setThemeState(m)
      setAccentState(a)
      applyMode(m)
      applyAccent(a)
    }).catch(() => {
      applyMode('system')
      applyAccent('warm')
    })
  }, [])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyMode('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return { theme, setTheme, accent, setAccent }
}
