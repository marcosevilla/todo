import { Panel } from './Panel'
import { PrioritiesHero } from '@/components/priorities/PrioritiesHero'
import { EnergySelector } from '@/components/priorities/EnergySelector'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { format } from 'date-fns'

export function Dashboard() {
  const handleRefresh = () => {
    // Will be wired up in later subtasks
  }

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
          <RefreshButton onRefresh={handleRefresh} />
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
              <p className="text-sm text-muted-foreground">
                Calendar events will appear here.
              </p>
            </Panel>

            <Panel title="Tasks" icon="✓" className="min-h-[200px]">
              <p className="text-sm text-muted-foreground">
                Todoist tasks will appear here.
              </p>
            </Panel>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <Panel title="Today" icon="📝" className="min-h-[200px]">
              <p className="text-sm text-muted-foreground">
                Obsidian today.md will appear here.
              </p>
            </Panel>

            <Panel title="Quick Captures" icon="💡" className="min-h-[200px]">
              <p className="text-sm text-muted-foreground">
                Captures from Obsidian inbox will appear here.
              </p>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  )
}
