import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TaskItem } from '@/components/tasks/TaskItem'
import { openUrl } from '@/services/tauri'
import type { TodoistTaskRow } from '@/services/tauri'
import { ExternalLink, Clock } from 'lucide-react'

interface TaskRowProps {
  task: TodoistTaskRow
  onComplete: (id: string) => void
  onSnooze: (id: string) => void
  focused?: boolean
}

export function TaskRow({ task, onComplete, onSnooze, focused }: TaskRowProps) {
  const handleToggle = useCallback(
    () => onComplete(task.id),
    [onComplete, task.id],
  )

  return (
    <div className="group relative flex items-center">
      <TaskItem
        task={{
          id: task.id,
          content: task.content,
          priority: task.priority,
          completed: false,
          dueDate: task.due_date,
          projectName: task.project_name,
          projectColor: '#e44332', // Todoist red
          source: 'todoist',
        }}
        onToggle={handleToggle}
        focused={focused}
        className="flex-1"
      />

      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onSnooze(task.id)}
              />
            }
          >
            <Clock className="size-3" />
          </TooltipTrigger>
          <TooltipContent>Snooze to tomorrow</TooltipContent>
        </Tooltip>
        {task.todoist_url && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => openUrl(task.todoist_url!)}
                />
              }
            >
              <ExternalLink className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Open in Todoist</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
