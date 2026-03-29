import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Trash2, FolderInput, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FocusPlayMenu } from '@/components/focus/FocusPlayMenu'
import { useFocusStore } from '@/stores/focusStore'
import { breakDownTask, createLocalTask, updateLocalTask, deleteLocalTask, logActivity } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { toast } from 'sonner'
import { taskToast } from '@/lib/taskToast'
import type { LocalTask, Project } from '@/services/tauri'

interface TaskActionBarProps {
  task: LocalTask
  projects: Project[]
  onDeleted: () => void
}

export function TaskActionBar({ task, projects, onDeleted }: TaskActionBarProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [breaking, setBreaking] = useState(false)

  const otherProjects = projects.filter((p) => p.id !== task.project_id)

  const handleMove = useCallback(async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    try {
      await updateLocalTask({ id: task.id, projectId })
      taskToast(`Moved to ${project?.name ?? 'project'}`, task.id)
      emitTasksChanged()
      setShowMoveMenu(false)
    } catch (e) {
      toast.error(`Failed to move: ${e}`)
    }
  }, [task.id, projects])

  const handleBreakDown = useCallback(async () => {
    setBreaking(true)
    try {
      const subtasks = await breakDownTask(task.content, task.description ?? undefined)
      let created = 0
      for (const content of subtasks) {
        try {
          await createLocalTask({ content, parentId: task.id, projectId: task.project_id })
          created++
        } catch { /* skip */ }
      }
      logActivity('task_breakdown_applied', task.id, { subtask_count: created }).catch(() => {})
      taskToast(`Created ${created} subtasks`, task.id)
      emitTasksChanged()
    } catch (e) {
      toast.error(`Breakdown failed: ${e}`)
    } finally {
      setBreaking(false)
    }
  }, [task])

  const handleDelete = useCallback(async () => {
    try {
      await deleteLocalTask(task.id)
      emitTasksChanged()
      toast.success('Task deleted')
      onDeleted()
    } catch (e) {
      toast.error(`Failed to delete: ${e}`)
    }
  }, [task.id, onDeleted])

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {!task.completed && !useFocusStore.getState().isActive && (
        <FocusPlayMenu task={task} />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleBreakDown}
        disabled={breaking}
        className="gap-1.5 text-muted-foreground"
      >
        <Sparkles className="size-3.5" />
        {breaking ? 'Breaking down...' : 'Break down'}
      </Button>

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMoveMenu(!showMoveMenu)}
          className="gap-1.5 text-muted-foreground"
        >
          <FolderInput className="size-3.5" />
          Move
        </Button>
        {showMoveMenu && (
          <div className="absolute left-0 top-full z-50 mt-1 animate-in fade-in slide-in-from-top-1 duration-100">
            <div className="w-36 rounded-lg border border-border/50 bg-popover p-1 shadow-lg ring-1 ring-foreground/10">
              {otherProjects.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/20 transition-colors"
                  onClick={() => handleMove(p.id)}
                >
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        className="gap-1.5 text-destructive/60 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
    </div>
  )
}
