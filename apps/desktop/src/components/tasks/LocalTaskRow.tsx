import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronRight, Trash2, Plus, Pencil } from 'lucide-react'
import { useFocusStore } from '@/stores/focusStore'
import { useDetailStore } from '@/stores/detailStore'
import { FocusPlayMenu } from '@/components/focus/FocusPlayMenu'
import { TaskItem } from './TaskItem'
import { TaskEditor } from './TaskEditor'
import type { LocalTask, Project } from '@daily-triage/types'

interface LocalTaskRowProps {
  task: LocalTask
  subtasks?: LocalTask[]
  projects?: Project[]
  projectName?: string
  projectColor?: string
  onDelete: (id: string) => void
  onAddSubtask: (parentId: string, content: string) => void
  onUpdated?: (task: LocalTask) => void
  focused?: boolean
}

export function LocalTaskRow({
  task,
  subtasks = [],
  projects = [],
  projectName,
  projectColor,
  onDelete,
  onAddSubtask,
  onUpdated,
  focused,
}: LocalTaskRowProps) {
  const [expanded, setExpanded] = useState(subtasks.length > 0)
  const [editing, setEditing] = useState(false)
  const [showSubInput, setShowSubInput] = useState(false)
  const [subInput, setSubInput] = useState('')
  const [focusMenuOpen, setFocusMenuOpen] = useState(false)
  const focusActive = useFocusStore((s) => s.isActive)

  const hasSubtasks = subtasks.length > 0

  const handleSubSubmit = useCallback(() => {
    const text = subInput.trim()
    if (!text) return
    onAddSubtask(task.id, text)
    setSubInput('')
    setExpanded(true)
  }, [subInput, task.id, onAddSubtask])

  const handleUpdated = useCallback(
    (updated: LocalTask) => {
      onUpdated?.(updated)
      setEditing(false)
    },
    [onUpdated],
  )

  return (
    <div>
      {/* Main task row */}
      <div className={cn('group relative flex min-w-0 items-center', focusMenuOpen && 'bg-accent/10 rounded-md')}>
        {/* Expand toggle */}
        {hasSubtasks && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="absolute -left-5 flex size-4 items-center justify-center"
          >
            <ChevronRight
              className={cn(
                'size-3 text-muted-foreground transition-transform duration-150',
                expanded && 'rotate-90',
              )}
            />
          </button>
        )}

        <TaskItem
          task={{
            id: task.id,
            content: task.content,
            priority: task.priority,
            completed: task.completed,
            status: task.status,
            dueDate: task.due_date,
            projectName: projectName,
            projectColor: projectColor,
            description: task.description,
            source: 'local',
          }}
          onContentClick={() => useDetailStore.getState().openTask(task.id)}
          focused={focused}
          className="flex-1"
        />

        {/* Hover actions */}
        <div className={cn('flex shrink-0 items-center gap-0.5 transition-opacity', focusMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
          {!task.completed && !focusActive && (
            <FocusPlayMenu task={task} onOpenChange={setFocusMenuOpen} />
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setEditing(!editing)}
            aria-label="Edit task"
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowSubInput(!showSubInput)}
            aria-label="Add subtask"
          >
            <Plus className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(task.id)}
            className="text-destructive/60 hover:text-destructive"
            aria-label="Delete task"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Inline editor */}
      {editing && (
        <div className="ml-7 mt-1 mb-2">
          <TaskEditor
            task={task}
            projects={projects}
            onClose={() => setEditing(false)}
            onUpdated={handleUpdated}
          />
        </div>
      )}

      {/* Subtask input */}
      {showSubInput && !editing && (
        <div className="ml-12 mt-0.5 mb-0.5">
          <Input
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubSubmit()
              if (e.key === 'Escape') { setShowSubInput(false); setSubInput('') }
            }}
            placeholder="Add subtask..."
            className="h-7 text-sm"
            autoFocus
          />
        </div>
      )}

      {/* Subtasks */}
      {expanded && subtasks.length > 0 && (
        <div className="ml-7 border-l border-border/30 pl-2 space-y-0">
          {subtasks.map((sub) => (
            <div key={sub.id} className="group/sub relative flex min-w-0 items-center">
              <TaskItem
                task={{
                  id: sub.id,
                  content: sub.content,
                  priority: sub.priority,
                  completed: sub.completed,
                  status: sub.status,
                  dueDate: sub.due_date,
                  source: 'local',
                }}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDelete(sub.id)}
                className="opacity-0 group-hover/sub:opacity-100 text-destructive/60 hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
