import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { SetupDialog } from '@/components/setup/SetupDialog'
import { Dashboard } from '@/components/layout/Dashboard'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { useDataProvider } from '@/services/provider-context'
import { Agentation } from 'agentation'

function App() {
  useTheme() // Initialize theme system
  const dp = useDataProvider()

  const setupComplete = useAppStore((s) => s.setupComplete)
  const setSetupComplete = useAppStore((s) => s.setSetupComplete)

  useEffect(() => {
    dp.settings.checkSetupComplete().then(setSetupComplete).catch(() => setSetupComplete(false))
  }, [dp, setSetupComplete])

  // Log app_opened once on mount
  const loggedOpen = useRef(false)
  useEffect(() => {
    if (!loggedOpen.current) {
      loggedOpen.current = true
      dp.activity.log('app_opened').catch(() => {})
    }
  }, [dp])

  // Auto-sync on launch: push then pull if Turso is configured
  const syncedOnLaunch = useRef(false)
  useEffect(() => {
    if (syncedOnLaunch.current) return
    syncedOnLaunch.current = true

    dp.sync.getStatus().then((status) => {
      if (status.turso_configured && status.remote_initialized) {
        // Non-blocking: fire and forget
        dp.sync.push()
          .then(() => dp.sync.pull())
          .catch((e) => {
            console.warn('Auto-sync on launch failed:', e)
          })
      }
    }).catch(() => {
      // Sync not available yet, skip
    })
  }, [dp])

  // Auto-hide scrollbars after 2s of inactivity
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>()
    function handleScroll(e: Event) {
      const el = e.target as Element
      if (!(el instanceof HTMLElement)) return
      el.classList.add('is-scrolling')
      const prev = timers.get(el)
      if (prev) clearTimeout(prev)
      timers.set(el, setTimeout(() => el.classList.remove('is-scrolling'), 2000))
    }
    document.addEventListener('scroll', handleScroll, true)
    return () => document.removeEventListener('scroll', handleScroll, true)
  }, [])

  // Log page changes
  const prevPage = useRef(useAppStore.getState().currentPage)
  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      if (state.currentPage !== prevPage.current) {
        prevPage.current = state.currentPage
        dp.activity.log('page_viewed', undefined, { page: state.currentPage }).catch(() => {})
      }
    })
    return unsub
  }, [dp])

  // Still checking
  if (setupComplete === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // Needs setup
  if (!setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SetupDialog open onComplete={() => setSetupComplete(true)} />
      </div>
    )
  }

  // Main app
  return (
    <TooltipProvider>
      <Dashboard />
      <Toaster position="bottom-right" />
      {import.meta.env.DEV && <Agentation />}
    </TooltipProvider>
  )
}

export default App
