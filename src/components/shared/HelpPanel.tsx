import { useState } from 'react'
import { cn } from '@/lib/utils'
import { HelpCircle, X, Keyboard, Map } from 'lucide-react'

// ── Tab types ──
type Tab = 'shortcuts' | 'roadmap'

// ── Shortcuts data ──
interface ShortcutRow { key: string; action: string }
interface ShortcutSection { title: string; shortcuts: ShortcutRow[] }

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: '1-4', action: 'Jump to page' },
      { key: '\u2318K', action: 'Command bar' },
      { key: '\u2318,', action: 'Settings' },
    ],
  },
  {
    title: 'Tasks',
    shortcuts: [
      { key: 'j / \u2193', action: 'Next task' },
      { key: 'k / \u2191', action: 'Previous task' },
      { key: 'Q', action: 'Quick create task' },
    ],
  },
  {
    title: 'Focus',
    shortcuts: [
      { key: 'Space', action: 'Pause / resume' },
      { key: 'Escape', action: 'Minimize / stop' },
    ],
  },
  {
    title: 'Command Bar',
    shortcuts: [
      { key: '\u2325C', action: 'Complete task' },
      { key: '\u2325B', action: 'AI breakdown' },
      { key: '\u2325M', action: 'Move to project' },
      { key: '/task', action: 'Force create mode' },
      { key: '/capture', action: 'Force capture mode' },
      { key: '/search', action: 'Force search mode' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: '\u2318R', action: 'Refresh all data' },
      { key: '\u2318\u21E7T', action: 'Toggle window' },
      { key: 'Escape', action: 'Close detail view' },
    ],
  },
]

// ── Roadmap data ──
interface RoadmapItem {
  title: string
  description: string
  done: boolean
  phase?: string
}

const ROADMAP: RoadmapItem[] = [
  // Done
  { title: 'Activity Log', description: 'Timestamps every action, powers reflection', done: true },
  { title: 'Command Bar', description: 'Cmd+K overlay with search, create, capture, AI breakdown', done: true },
  { title: 'Focus Mode', description: 'Pomodoro timer, celebration, auto-queue next task', done: true },
  { title: 'Activity Timeline', description: 'Browse daily activity with summary stats', done: true },
  { title: 'Task Detail Page', description: 'Body + sidebar modes, inline editing, breadcrumbs', done: true },
  { title: 'Task Status System', description: 'Backlog → Todo → In Progress → Blocked → Complete', done: true },
  { title: 'Mutable Inbox', description: 'Native tasks + captures with actions', done: true },
  { title: 'Resizable Sidebars', description: 'Drag to resize nav + right sidebar', done: true },

  // Near-term
  { title: 'Captures Migration', description: 'Move captures to SQLite, CaptureDetailPage, import from Obsidian', done: false, phase: 'Near-term' },
  { title: 'Status Configurable Colors', description: 'Customize status icon colors in Settings', done: false, phase: 'Near-term' },
  { title: 'Focus Abandon Setting', description: 'Configure default status when abandoning focus', done: false, phase: 'Near-term' },
  { title: 'Task Filtering by Status', description: 'Filter/sort tasks page by status, show In Progress first', done: false, phase: 'Near-term' },

  // Phase A
  { title: 'Daily Brief Display', description: 'Show the 4am brief in morning review flow', done: false, phase: 'A: Morning' },
  { title: 'Energy Write-back', description: 'Write energy level to Obsidian, show 7-day sparkline', done: false, phase: 'A: Morning' },
  { title: 'Smart Capture Routing', description: '/idea → Ideas.md, /quote → Quotes.md', done: false, phase: 'A: Morning' },

  // Phase B
  { title: 'Evening Review Flow', description: 'Guided reflection: accomplishments, questions, energy, affirmation', done: false, phase: 'B: Evening' },
  { title: 'Energy Trends', description: '30-90 day sparkline, best days analysis', done: false, phase: 'B: Evening' },

  // Phase C
  { title: 'Bingo Card View', description: 'Visual 5x5 grid of 2026 goals', done: false, phase: 'C: Goals' },
  { title: 'Resolutions Compass', description: 'Keywords + rules from resolutions file', done: false, phase: 'C: Goals' },
  { title: 'Habit Unification', description: 'One canonical habit source, checkable from app', done: false, phase: 'C: Goals' },

  // Phase D
  { title: 'Linear Tickets', description: 'Show assigned Linear tickets with status badges', done: false, phase: 'D: Work' },
  { title: 'Needs Response Queue', description: 'Urgent Slack/email items ranked by priority', done: false, phase: 'D: Work' },
  { title: 'Telegram Capture Sync', description: 'Show Telegram captures in Inbox', done: false, phase: 'D: Work' },

  // Phase E
  { title: 'Multi-device Sync', description: 'Sync via Obsidian vault or cloud SQLite', done: false, phase: 'E: Infra' },
  { title: 'Native Notifications', description: 'Meeting reminders, evening nudge, open tasks', done: false, phase: 'E: Infra' },
  { title: '.dmg Distribution', description: 'Signed build, auto-updater via GitHub Releases', done: false, phase: 'E: Infra' },

  // Ideas
  { title: 'AI Reflection', description: 'Weekly trends, dropoff analysis, pattern recognition', done: false, phase: 'Ideas' },
  { title: 'AI Next-task Picker', description: 'Claude picks next task based on energy + context', done: false, phase: 'Ideas' },
  { title: 'Full-page Detail Mode', description: 'Third display mode for task detail', done: false, phase: 'Ideas' },
]

// ── Component ──

export function HelpPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('shortcuts')
  const [showDone, setShowDone] = useState(false)

  const doneCount = ROADMAP.filter((r) => r.done).length
  const totalCount = ROADMAP.length

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-4 right-4 z-30 flex size-9 items-center justify-center rounded-full transition-all duration-200',
          'bg-muted/60 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground hover:shadow-md',
          'backdrop-blur-sm border border-border/20',
          open && 'bg-muted text-muted-foreground shadow-md',
        )}
      >
        {open ? <X className="size-4" /> : <HelpCircle className="size-4" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-30 help-panel-enter">
          <div className="w-80 max-h-[70vh] flex flex-col rounded-xl border border-border/30 bg-popover shadow-xl shadow-black/10 overflow-hidden">
            {/* Tab switcher */}
            <div className="flex items-center border-b border-border/20 px-1 pt-1">
              <button
                onClick={() => setTab('shortcuts')}
                className={cn(
                  'flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors',
                  tab === 'shortcuts'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Keyboard className="size-3" />
                Shortcuts
              </button>
              <button
                onClick={() => setTab('roadmap')}
                className={cn(
                  'flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors',
                  tab === 'roadmap'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Map className="size-3" />
                Roadmap
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">{doneCount}/{totalCount}</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {tab === 'shortcuts' ? (
                <ShortcutsTab />
              ) : (
                <RoadmapTab showDone={showDone} setShowDone={setShowDone} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Shortcuts tab ──

function ShortcutsTab() {
  return (
    <div className="space-y-4">
      {SHORTCUT_SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            {section.title}
          </h3>
          <div className="space-y-1">
            {section.shortcuts.map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-muted-foreground">{shortcut.action}</span>
                <kbd className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Roadmap tab ──

function RoadmapTab({ showDone, setShowDone }: { showDone: boolean; setShowDone: (v: boolean) => void }) {
  const items = showDone ? ROADMAP : ROADMAP.filter((r) => !r.done)

  // Group by phase
  const groups: Record<string, RoadmapItem[]> = {}
  for (const item of items) {
    const key = item.done ? 'Completed' : (item.phase ?? 'Other')
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/50">
          {ROADMAP.filter((r) => !r.done).length} remaining
        </span>
        <button
          onClick={() => setShowDone(!showDone)}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {showDone ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      {Object.entries(groups).map(([phase, phaseItems]) => (
        <div key={phase}>
          <h3 className={cn(
            'mb-1.5 text-[10px] font-medium uppercase tracking-wider',
            phase === 'Completed' ? 'text-green-500/50' : 'text-muted-foreground/50',
          )}>
            {phase}
          </h3>
          <div className="space-y-1.5">
            {phaseItems.map((item) => (
              <div key={item.title} className="flex items-start gap-2">
                <span className={cn(
                  'mt-1 size-1.5 shrink-0 rounded-full',
                  item.done ? 'bg-green-500/40' : 'bg-muted-foreground/20',
                )} />
                <div className="min-w-0">
                  <p className={cn(
                    'text-xs font-medium',
                    item.done && 'text-muted-foreground line-through',
                  )}>
                    {item.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 leading-snug">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
