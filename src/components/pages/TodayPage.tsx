import { useMemo, useState, useCallback, useEffect } from 'react'
import { TodayPanel } from '@/components/obsidian/TodayPanel'
import { TaskRow } from '@/components/todoist/TaskRow'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { useTodoist } from '@/hooks/useTodoist'
import { useLocalTasks, useProjects } from '@/hooks/useLocalTasks'
import { LocalTaskRow } from '@/components/tasks/LocalTaskRow'
import { PrioritiesSection } from '@/components/priorities/PrioritiesSection'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useObsidian } from '@/hooks/useObsidian'
import { useTaskNavigation } from '@/hooks/useTaskNavigation'
import { useCalendar } from '@/hooks/useCalendar'
import { cn } from '@/lib/utils'
import { openUrl, getDailyState } from '@/services/tauri'
import type { Priority, TodoistTaskRow } from '@/services/tauri'
import { AlertTriangle, Zap, Calendar, ArrowRight, Check, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

// ── Shared Utilities ──

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <div className="flex items-center gap-3 mb-4 animate-progress-enter">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-green-500' : 'bg-accent-blue',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
        {completed}/{total}
      </span>
    </div>
  )
}

// ── Urgency Grouping ──

interface UrgencyGroup {
  key: string
  title: string
  tasks: TodoistTaskRow[]
  defaultOpen: boolean
}

function groupByUrgency(tasks: TodoistTaskRow[]): UrgencyGroup[] {
  const today = new Date().toISOString().slice(0, 10)
  const overdue: TodoistTaskRow[] = []
  const highPriority: TodoistTaskRow[] = []
  const dueToday: TodoistTaskRow[] = []
  const quickWins: TodoistTaskRow[] = []

  for (const task of tasks) {
    const isOverdue = task.due_date != null && task.due_date < today
    if (isOverdue) overdue.push(task)
    else if (task.priority >= 3) highPriority.push(task)
    else if (task.content.length < 50 && task.priority <= 2) quickWins.push(task)
    else dueToday.push(task)
  }

  const groups: UrgencyGroup[] = []
  if (overdue.length > 0) groups.push({ key: 'overdue', title: 'Overdue', tasks: overdue, defaultOpen: true })
  if (highPriority.length > 0) groups.push({ key: 'high', title: 'High Priority', tasks: highPriority, defaultOpen: true })
  if (dueToday.length > 0) groups.push({ key: 'today', title: 'Due Today', tasks: dueToday, defaultOpen: true })
  if (quickWins.length > 0) groups.push({ key: 'quick', title: 'Quick Wins', tasks: quickWins, defaultOpen: false })
  return groups
}

function urgencyIcon(key: string): React.ReactNode | undefined {
  if (key === 'overdue') return <AlertTriangle size={14} className="text-destructive/60" />
  if (key === 'quick') return <Zap size={14} className="text-muted-foreground" />
  return undefined
}

// ── Review Step Components ──

function ReviewStep({
  step,
  title,
  active,
  completed: done,
  children,
}: {
  step: number
  title: string
  active: boolean
  completed: boolean
  children: React.ReactNode
}) {
  if (!active && !done) return null

  return (
    <div className={cn(
      'rounded-lg border p-4 transition-all duration-300',
      active ? 'bg-card border-border' : 'bg-muted/30 border-border/30',
      active && 'animate-in fade-in slide-in-from-bottom-2 duration-200',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
          done ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground',
        )}>
          {done ? <Check className="size-3.5" /> : step}
        </span>
        <h3 className={cn(
          'text-sm font-medium',
          done && 'text-muted-foreground',
        )}>
          {title}
        </h3>
      </div>
      {active && <div>{children}</div>}
    </div>
  )
}

function CalendarGlance() {
  const { events, loading } = useCalendar()

  if (loading) {
    return (
      <div className="space-y-1.5">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No meetings today — wide open for deep work.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {events.slice(0, 5).map((event) => (
        <div key={event.id} className="flex items-center gap-3 text-sm">
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {event.all_day ? 'All day' : event.start_time.slice(0, 5)}
          </span>
          {event.feed_color && (
            <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: event.feed_color }} />
          )}
          <span className="truncate">{event.summary}</span>
        </div>
      ))}
      {events.length > 5 && (
        <p className="text-xs text-muted-foreground pl-[62px]">
          +{events.length - 5} more
        </p>
      )}
    </div>
  )
}

function TriageSection({
  todoistTasks,
  onComplete,
  onSnooze,
}: {
  todoistTasks: TodoistTaskRow[]
  onComplete: (id: string) => void
  onSnooze: (id: string) => void
}) {
  const overdue = todoistTasks.filter((t) => {
    const today = new Date().toISOString().slice(0, 10)
    return t.due_date != null && t.due_date < today
  })
  const highPriority = todoistTasks.filter((t) => t.priority >= 3)
  const needsAttention = [...overdue, ...highPriority.filter((t) => !overdue.includes(t))]

  if (needsAttention.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing urgent — you're in good shape.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">
        {needsAttention.length} item{needsAttention.length !== 1 ? 's' : ''} need attention. Complete or snooze to clear them.
      </p>
      {needsAttention.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onComplete={onComplete}
          onSnooze={onSnooze}
        />
      ))}
    </div>
  )
}

// ── Review Mode ──

function ReviewMode({ onComplete }: { onComplete: (priorities: Priority[]) => void }) {
  const [step, setStep] = useState(1)
  const [priorities, setPriorities] = useState<Priority[] | null>(null)
  const { tasks: todoistTasks, completeTask, snoozeTask } = useTodoist()
  const now = new Date()
  const dateStr = format(now, 'EEEE, MMMM d')

  const handlePrioritiesGenerated = useCallback((p: Priority[]) => {
    setPriorities(p)
    setStep(3)
  }, [])

  const handleFinish = useCallback(() => {
    if (priorities) onComplete(priorities)
  }, [priorities, onComplete])

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Greeting */}
      <div className="text-center space-y-1 py-4">
        <h2 className="text-xl font-semibold tracking-tight">{getGreeting()}</h2>
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>{dateStr}</span>
        </div>
        <p className="text-sm text-muted-foreground pt-1">Let's plan your day.</p>
      </div>

      {/* Step 1: Calendar glance */}
      <ReviewStep step={1} title="Your schedule" active={step === 1} completed={step > 1}>
        <CalendarGlance />
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={() => setStep(2)} className="gap-1.5">
            Next <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </ReviewStep>

      {/* Step 2: Energy + Priorities */}
      <ReviewStep step={2} title="Set your energy & get priorities" active={step === 2} completed={step > 2}>
        <PrioritiesSection onGenerated={handlePrioritiesGenerated} />
      </ReviewStep>

      {/* Step 3: Triage */}
      <ReviewStep step={3} title="Quick triage" active={step === 3} completed={step > 3}>
        <TriageSection
          todoistTasks={todoistTasks}
          onComplete={completeTask}
          onSnooze={snoozeTask}
        />
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={handleFinish} className="gap-1.5">
            <Check className="size-3.5" /> Ready to go
          </Button>
        </div>
      </ReviewStep>
    </div>
  )
}

// ── Dashboard Mode ──

function DashboardMode({ cachedPriorities }: { cachedPriorities: Priority[] | null }) {
  const { tasks: todoistTasks, completeTask, snoozeTask } = useTodoist()
  const { todayData } = useObsidian()
  const today = new Date().toISOString().slice(0, 10)
  const { tasks: localTasks, loading: localLoading, complete: completeLocal, uncomplete: uncompleteLocal, remove: removeLocal, addTask, refresh: refreshLocal } = useLocalTasks({ dueDate: today })
  const { projects } = useProjects()
  const projectMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {}
    for (const p of projects) map[p.id] = { name: p.name, color: p.color }
    return map
  }, [projects])

  const topLevelLocal = useMemo(() => localTasks.filter((t) => !t.parent_id), [localTasks])
  const subtaskMap = useMemo(() => {
    const map: Record<string, typeof localTasks> = {}
    for (const t of localTasks) {
      if (t.parent_id) {
        if (!map[t.parent_id]) map[t.parent_id] = []
        map[t.parent_id].push(t)
      }
    }
    return map
  }, [localTasks])

  const handleAddSubtask = useCallback(
    async (parentId: string, content: string) => {
      const parent = localTasks.find((t) => t.id === parentId)
      await addTask(content, { parentId, projectId: parent?.project_id, dueDate: today })
      refreshLocal()
    },
    [localTasks, addTask, refreshLocal, today],
  )

  const obsidianChecked = todayData?.tasks.filter((t) => t.checked).length ?? 0
  const obsidianTotal = todayData?.tasks.length ?? 0
  const localCompleted = localTasks.filter((t) => t.completed && !t.parent_id).length
  const completed = obsidianChecked + localCompleted
  const total = obsidianTotal + topLevelLocal.length + todoistTasks.length

  const urgencyGroups = useMemo(() => groupByUrgency(todoistTasks), [todoistTasks])
  const flatTaskIds = useMemo(() => urgencyGroups.flatMap((g) => g.tasks.map((t) => t.id)), [urgencyGroups])

  const handleOpen = useCallback(
    (taskId: string) => {
      const task = todoistTasks.find((t) => t.id === taskId)
      if (task?.todoist_url) openUrl(task.todoist_url)
    },
    [todoistTasks],
  )

  const { focusedIndex } = useTaskNavigation(flatTaskIds, {
    onComplete: completeTask,
    onSnooze: snoozeTask,
    onOpen: handleOpen,
  })

  const now = new Date()
  const dateStr = format(now, 'EEEE, MMMM d')
  const remaining = total - completed

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="mb-2 space-y-1">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{getGreeting()}</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            <span>{dateStr}</span>
          </div>
        </div>
        {total > 0 && (
          <p className="text-sm text-muted-foreground">
            {remaining === 0 ? 'All done for today.' : `${remaining} item${remaining === 1 ? '' : 's'} remaining`}
          </p>
        )}
      </div>

      {/* Cached priorities */}
      {cachedPriorities && cachedPriorities.length > 0 && (
        <PrioritiesSection initialPriorities={cachedPriorities} />
      )}

      {completed > 0 && <ProgressBar completed={completed} total={total} />}

      <CollapsibleSection title="Today" count={undefined} defaultOpen={true}>
        <TodayPanel />
      </CollapsibleSection>

      {!localLoading && topLevelLocal.length > 0 && (
        <CollapsibleSection title="Tasks" count={topLevelLocal.filter((t) => !t.completed).length} defaultOpen={true}>
          <div className="space-y-0.5">
            {topLevelLocal.map((task) => (
              <LocalTaskRow
                key={task.id}
                task={task}
                subtasks={subtaskMap[task.id] || []}
                projects={projects}
                projectName={projectMap[task.project_id]?.name}
                projectColor={projectMap[task.project_id]?.color}
                onComplete={completeLocal}
                onUncomplete={uncompleteLocal}
                onDelete={removeLocal}
                onAddSubtask={handleAddSubtask}
                onUpdated={refreshLocal}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {todoistTasks.length > 0 && (
        <CollapsibleSection title="Todoist" count={todoistTasks.length} defaultOpen={false}>
          <div className="space-y-0.5">
            {urgencyGroups.map((group) => (
              <CollapsibleSection
                key={group.key}
                title={group.title}
                count={group.tasks.length}
                defaultOpen={group.defaultOpen}
                variant="nested"
                icon={urgencyIcon(group.key)}
              >
                {group.tasks.map((task, i) => (
                  <TaskRow key={task.id} task={task} onComplete={completeTask} onSnooze={snoozeTask} />
                ))}
              </CollapsibleSection>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

// ── Today Page (Router) ──

export function TodayPage() {
  const [reviewComplete, setReviewComplete] = useState<boolean | null>(null) // null = loading
  const [cachedPriorities, setCachedPriorities] = useState<Priority[] | null>(null)

  // Check if today's review has been done
  useEffect(() => {
    // Fallback timeout — if getDailyState takes too long, show review mode
    const timeout = setTimeout(() => {
      setReviewComplete((prev) => prev === null ? false : prev)
    }, 2000)

    getDailyState().then((state) => {
      clearTimeout(timeout)
      setReviewComplete(state.review_complete)
      if (state.priorities) setCachedPriorities(state.priorities)
    }).catch(() => {
      clearTimeout(timeout)
      setReviewComplete(false) // Assume not done on error
    })

    return () => clearTimeout(timeout)
  }, [])

  const handleReviewComplete = useCallback((priorities: Priority[]) => {
    setCachedPriorities(priorities)
    setReviewComplete(true)
  }, [])

  // Loading state while checking daily state
  if (reviewComplete === null) {
    return (
      <div className="max-w-lg mx-auto space-y-4 py-4">
        <div className="text-center space-y-1">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    )
  }

  // Review mode (first open of the day)
  if (!reviewComplete) {
    return <ReviewMode onComplete={handleReviewComplete} />
  }

  // Dashboard mode (review done)
  return <DashboardMode cachedPriorities={cachedPriorities} />
}
