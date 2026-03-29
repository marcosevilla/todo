import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'

// ── Priority Indicator ──

const PRIORITY_COLORS: Record<number, string> = {
  4: 'bg-red-500',
  3: 'bg-orange-500',
  2: 'bg-accent-blue',
  1: 'bg-transparent',
}

function PriorityIndicator({ priority }: { priority: number }) {
  if (priority <= 1) return <div className="w-3 shrink-0" />

  return (
    <div className="flex w-3 shrink-0 items-center justify-center">
      <span className={cn('size-2 rounded-full', PRIORITY_COLORS[priority] ?? 'bg-transparent')} />
    </div>
  )
}

// ── Due Date Badge ──

function DueDateBadge({ date }: { date: string }) {
  const parsed = parseISO(date)
  const overdue = isPast(parsed) && !isToday(parsed)

  let label: string
  if (isToday(parsed)) label = 'Today'
  else if (isTomorrow(parsed)) label = 'Tomorrow'
  else label = format(parsed, 'MMM d')

  return (
    <span
      className={cn(
        'shrink-0 text-[11px] tabular-nums',
        overdue ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

// ── Project Badge ──

function ProjectBadge({ name, color }: { name: string; color?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color ?? '#6366f1' }}
      />
      {name}
    </span>
  )
}

// ── Unified Task Item ──

export interface TaskItemData {
  id: string
  content: string
  priority: number
  completed: boolean
  dueDate?: string | null
  projectName?: string | null
  projectColor?: string | null
  description?: string | null
  source: 'local' | 'todoist'
}

interface TaskItemProps {
  task: TaskItemData
  onToggle: (id: string) => void
  focused?: boolean
  className?: string
}

export function TaskItem({ task, onToggle, focused, className }: TaskItemProps) {
  const [completing, setCompleting] = useState(false)

  const handleToggle = useCallback(() => {
    if (task.completed) {
      onToggle(task.id)
    } else {
      setCompleting(true)
      setTimeout(() => onToggle(task.id), 600)
    }
  }, [task.id, task.completed, onToggle])

  return (
    <div
      className={cn(
        'group flex items-center gap-2 h-9 px-2 rounded-md transition-all duration-150 hover:bg-accent/30',
        completing && 'animate-task-complete',
        focused && 'ring-1 ring-accent-blue/40 bg-accent/10',
        className,
      )}
    >
      {/* Priority */}
      <PriorityIndicator priority={task.priority} />

      {/* Status checkbox */}
      <Checkbox
        checked={task.completed}
        onCheckedChange={handleToggle}
        className="shrink-0 border-muted-foreground/30"
      />

      {/* Task name */}
      <span
        className={cn(
          'flex-1 min-w-0 truncate text-sm',
          task.completed && 'text-muted-foreground line-through',
        )}
      >
        {task.content}
      </span>

      {/* Right side metadata */}
      <div className="flex shrink-0 items-center gap-2">
        {task.projectName && (
          <ProjectBadge name={task.projectName} color={task.projectColor ?? undefined} />
        )}
        {task.dueDate && <DueDateBadge date={task.dueDate} />}
      </div>
    </div>
  )
}
