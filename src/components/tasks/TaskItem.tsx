import { cn } from '@/lib/utils'
import { PRIORITY_COLORS } from '@/lib/priorities'
import { Check } from 'lucide-react'
import { StatusDropdown } from './StatusDropdown'
import { useSelectionStore } from '@/stores/selectionStore'
import type { TaskStatus } from '@/services/tauri'
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'

// ── Priority Indicator ──

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
  status?: TaskStatus
  dueDate?: string | null
  projectName?: string | null
  projectColor?: string | null
  description?: string | null
  source: 'local' | 'todoist'
}

interface TaskItemProps {
  task: TaskItemData
  onContentClick?: () => void
  allIds?: string[]
  focused?: boolean
  className?: string
}

export function TaskItem({ task, onContentClick, allIds, focused, className }: TaskItemProps) {
  const isSelected = useSelectionStore((s) => s.selectedIds.has(task.id))
  const hasSelection = useSelectionStore((s) => s.hasSelection)

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useSelectionStore.getState()
    if (e.shiftKey && allIds) {
      store.rangeSelect(task.id, 'task', allIds)
    } else {
      store.toggle(task.id, 'task')
    }
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 h-9 px-2 rounded-md transition-all duration-150 hover:bg-accent/30',
        focused && 'ring-1 ring-accent-blue/40 bg-accent/10',
        isSelected && 'bg-accent-blue/10',
        className,
      )}
    >
      {/* Selection checkbox */}
      <button
        onClick={handleSelectClick}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border transition-all',
          isSelected
            ? 'border-accent-blue bg-accent-blue text-white'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50',
          hasSelection || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {isSelected && <Check className="size-3" />}
      </button>

      {/* Priority */}
      <PriorityIndicator priority={task.priority} />

      {/* Status */}
      {task.source === 'local' && task.status ? (
        <StatusDropdown taskId={task.id} status={task.status} />
      ) : (
        <div className="w-4 shrink-0" />
      )}

      {/* Task name */}
      <span
        onClick={onContentClick}
        className={cn(
          'flex-1 min-w-0 truncate text-sm',
          (task.completed || task.status === 'complete') && 'text-muted-foreground line-through',
          onContentClick && 'cursor-pointer hover:text-foreground',
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
