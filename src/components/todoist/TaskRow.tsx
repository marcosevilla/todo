import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { open } from '@tauri-apps/plugin-shell'
import type { TodoistTaskRow } from '@/services/tauri'
import { cn } from '@/lib/utils'

// Todoist priority: 4=urgent(red), 3=high(orange), 2=medium(blue), 1=normal(gray)
const PRIORITY_COLORS: Record<number, string> = {
  4: 'border-red-500',
  3: 'border-orange-500',
  2: 'border-blue-500',
  1: 'border-muted',
}

interface TaskRowProps {
  task: TodoistTaskRow
  onComplete: (id: string) => void
  onSnooze: (id: string) => void
}

export function TaskRow({ task, onComplete, onSnooze }: TaskRowProps) {
  return (
    <div className="group flex items-start gap-2.5 py-1.5">
      <Checkbox
        className={cn('mt-0.5', PRIORITY_COLORS[task.priority])}
        onCheckedChange={() => onComplete(task.id)}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{task.content}</p>
        {task.project_name && (
          <span className="text-[10px] text-muted-foreground">
            {task.project_name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px]"
          onClick={() => onSnooze(task.id)}
          title="Snooze to tomorrow"
        >
          Snooze
        </Button>
        {task.todoist_url && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={() => open(task.todoist_url!)}
            title="Open in Todoist"
          >
            Open
          </Button>
        )}
      </div>
    </div>
  )
}
