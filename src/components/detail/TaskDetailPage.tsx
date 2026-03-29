import { useState, useCallback } from 'react'
import { useDetailStore } from '@/stores/detailStore'
import { useTaskDetail } from '@/hooks/useTaskDetail'
import { useProjects } from '@/hooks/useLocalTasks'
import { updateLocalTask, createLocalTask } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { cn } from '@/lib/utils'
import { StatusDropdown } from '@/components/tasks/StatusDropdown'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { InlineTitle } from './InlineTitle'
import { InlineDescription } from './InlineDescription'
import { DetailBreadcrumbs } from './DetailBreadcrumbs'
import { TaskActionBar } from './TaskActionBar'
import { TaskActivityLog } from './TaskActivityLog'
import { PanelRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Normal', color: 'bg-transparent' },
  2: { label: 'Medium', color: 'bg-accent-blue' },
  3: { label: 'High', color: 'bg-orange-500' },
  4: { label: 'Urgent', color: 'bg-red-500' },
}

export function TaskDetailPage() {
  const target = useDetailStore((s) => s.target)
  const switchMode = useDetailStore((s) => s.switchMode)
  const close = useDetailStore((s) => s.close)
  const drillDown = useDetailStore((s) => s.drillDown)

  const { task, subtasks, project, loading } = useTaskDetail(target?.id ?? null)
  const { projects } = useProjects()

  const [subInput, setSubInput] = useState('')

  const handleSaveTitle = useCallback(async (content: string) => {
    if (!task) return
    await updateLocalTask({ id: task.id, content })
    emitTasksChanged()
  }, [task])

  const handleSaveDescription = useCallback(async (description: string) => {
    if (!task) return
    await updateLocalTask({ id: task.id, description })
    emitTasksChanged()
  }, [task])

  const handleAddSubtask = useCallback(async () => {
    if (!task || !subInput.trim()) return
    try {
      await createLocalTask({ content: subInput.trim(), parentId: task.id, projectId: task.project_id })
      emitTasksChanged()
      setSubInput('')
    } catch (e) {
      toast.error(`Failed to add subtask: ${e}`)
    }
  }, [task, subInput])

  const handlePriorityChange = useCallback(async (priority: number) => {
    if (!task) return
    await updateLocalTask({ id: task.id, priority })
    emitTasksChanged()
  }, [task])

  if (loading) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumbs />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumbs />
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    )
  }

  const completedSubs = subtasks.filter((s) => s.completed).length

  return (
    <div className="space-y-6">
      {/* Header: breadcrumbs + mode controls */}
      <div className="flex items-start justify-between">
        <DetailBreadcrumbs />
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => switchMode('sidebar')}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Open in sidebar"
          >
            <PanelRight className="size-4" />
          </button>
          <button
            onClick={close}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Status + Title */}
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <StatusDropdown taskId={task.id} status={task.status ?? 'todo'} size="md" />
        </div>
        <div className="flex-1 min-w-0">
          <InlineTitle value={task.content} completed={task.completed} onSave={handleSaveTitle} />
        </div>
      </div>

      {/* Description */}
      <InlineDescription value={task.description} onSave={handleSaveDescription} />

      {/* Metadata row */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {/* Project */}
        {project && (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
            <span className="text-muted-foreground">{project.name}</span>
          </div>
        )}

        {/* Priority */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((p) => (
            <button
              key={p}
              onClick={() => handlePriorityChange(p)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors',
                task.priority === p
                  ? 'bg-accent/40 text-foreground'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/20',
              )}
            >
              {p > 1 && <span className={cn('size-1.5 rounded-full', PRIORITY_LABELS[p].color)} />}
              {PRIORITY_LABELS[p].label}
            </button>
          ))}
        </div>

        {/* Due date */}
        {task.due_date && (
          <span className="text-xs text-muted-foreground">
            Due {format(parseISO(task.due_date), 'MMM d')}
          </span>
        )}
      </div>

      {/* Actions */}
      <TaskActionBar task={task} projects={projects} onDeleted={close} />

      {/* Subtasks */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
            Subtasks
          </h3>
          {subtasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground/40">
              {completedSubs}/{subtasks.length}
            </span>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="space-y-0.5">
            {subtasks.map((sub) => (
              <div
                key={sub.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/10 transition-colors"
              >
                <StatusDropdown taskId={sub.id} status={sub.status ?? 'todo'} />
                <button
                  onClick={() => drillDown({ type: 'task', id: sub.id })}
                  className={cn(
                    'flex-1 min-w-0 truncate text-left text-sm hover:text-foreground transition-colors',
                    sub.completed && 'text-muted-foreground line-through',
                  )}
                >
                  {sub.content}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add subtask */}
        <div className="flex items-center gap-2">
          <Input
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() }
            }}
            placeholder="Add a subtask..."
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border/30" />

      {/* Activity log */}
      <TaskActivityLog taskId={task.id} />
    </div>
  )
}
