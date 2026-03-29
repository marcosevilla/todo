import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'

// ── Priority Icon (Linear-style signal bars) ──

const PRIORITY_CONFIG: Record<number, { icon: string; color: string; label: string }> = {
  4: { icon: '!!!', color: 'text-red-500', label: 'Urgent' },
  3: { icon: '!!', color: 'text-orange-500', label: 'High' },
  2: { icon: '!', color: 'text-accent-blue', label: 'Medium' },
  1: { icon: '', color: 'text-muted-foreground/30', label: 'Normal' },
}

function PriorityIndicator({ priority }: { priority: number }) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG[1]
  if (priority <= 1) return <div className="w-5" /> // spacer for alignment

  return (
    <span className={cn('w-5 shrink-0 text-center text-[10px] font-bold', config.color)}>
      {config.icon}
    </span>
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
