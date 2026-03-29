import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { checkSetupComplete } from '@/services/tauri'
import { SetupDialog } from '@/components/setup/SetupDialog'
import { Dashboard } from '@/components/layout/Dashboard'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'

function App() {
  useTheme() // Initialize theme system

  const setupComplete = useAppStore((s) => s.setupComplete)
  const setSetupComplete = useAppStore((s) => s.setSetupComplete)

  useEffect(() => {
    checkSetupComplete().then(setSetupComplete).catch(() => setSetupComplete(false))
  }, [setSetupComplete])

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
    </TooltipProvider>
  )
}

export default App
