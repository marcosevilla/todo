import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { checkSetupComplete, logActivity } from '@/services/tauri'
import { SetupDialog } from '@/components/setup/SetupDialog'
import { Dashboard } from '@/components/layout/Dashboard'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { Agentation } from 'agentation'

function App() {
  useTheme() // Initialize theme system

  const setupComplete = useAppStore((s) => s.setupComplete)
  const setSetupComplete = useAppStore((s) => s.setSetupComplete)

  useEffect(() => {
    checkSetupComplete().then(setSetupComplete).catch(() => setSetupComplete(false))
  }, [setSetupComplete])

  // Log app_opened once on mount
  const loggedOpen = useRef(false)
  useEffect(() => {
    if (!loggedOpen.current) {
      loggedOpen.current = true
      logActivity('app_opened').catch(() => {})
    }
  }, [])

  // Log page changes
  const prevPage = useRef(useAppStore.getState().currentPage)
  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      if (state.currentPage !== prevPage.current) {
        prevPage.current = state.currentPage
        logActivity('page_viewed', undefined, { page: state.currentPage }).catch(() => {})
      }
    })
    return unsub
  }, [])

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
