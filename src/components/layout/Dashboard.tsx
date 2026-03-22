import { useCallback } from 'react'
import { Panel } from './Panel'
import { PrioritiesHero } from '@/components/priorities/PrioritiesHero'
import { EnergySelector } from '@/components/priorities/EnergySelector'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { TodayPanel } from '@/components/obsidian/TodayPanel'
import { TodoistPanel } from '@/components/todoist/TodoistPanel'
import { CalendarPanel } from '@/components/calendar/CalendarPanel'
import { CapturesPanel } from '@/components/obsidian/CapturesPanel'
import { SaveButton } from '@/components/shared/SaveButton'
import { useRefresh } from '@/hooks/useRefresh'
import { format } from 'date-fns'

export function Dashboard() {
  // Global refresh — each panel also loads independently on mount,
  // but this triggers a coordinated refresh of all sources
  const refreshAll = useCallback(async () => {
    // Individual panels manage their own data fetching via hooks.
    // This is a placeholder for coordinated refresh (e.g., re-fetch all).
    // For now, panels auto-refresh via their own useEffect on mount.
  }, [])

  const { triggerRefresh } = useRefresh(refreshAll)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daily Triage</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <EnergySelector />
          <RefreshButton onRefresh={triggerRefresh} />
          <SaveButton />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 space-y-5 p-6">
        {/* Hero: Top 3 Priorities */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Today's Focus
          </h2>
          <PrioritiesHero />
        </section>

        {/* Data Panels: 2-column grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            <Panel title="Schedule" icon="📅" className="min-h-[200px]">
              <CalendarPanel />
            </Panel>

            <Panel title="Tasks" icon="✓" className="min-h-[200px]">
              <TodoistPanel />
            </Panel>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <Panel title="Today" icon="📝" className="min-h-[200px]">
              <TodayPanel />
            </Panel>

            <Panel title="Quick Captures" icon="💡" className="min-h-[200px]">
              <CapturesPanel />
            </Panel>
          </div>
        </div>
      </main>
    </div>
  )
}
