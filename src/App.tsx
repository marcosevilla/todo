import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { checkSetupComplete } from '@/services/tauri'
import { SetupDialog } from '@/components/setup/SetupDialog'

function App() {
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SetupDialog
        open={!setupComplete}
        onComplete={() => setSetupComplete(true)}
      />

      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daily Triage</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </header>

      <main className="p-6">
        <p className="text-muted-foreground">Dashboard coming soon.</p>
      </main>
    </div>
  )
}

export default App
