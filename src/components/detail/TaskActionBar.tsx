import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Trash2, FolderInput, Sparkles, Play, ChevronRight } from 'lucide-react'
import { useFocusStore } from '@/stores/focusStore'
import { breakDownTask, createLocalTask, updateLocalTask, deleteLocalTask, logActivity } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { toast } from 'sonner'
import { taskToast } from '@/lib/taskToast'
import { ProjectPickerMenu } from '@/components/shared/ProjectPickerMenu'
import type { LocalTask, Project } from '@/services/tauri'

interface TaskActionBarProps {
  task: LocalTask
  projects: Project[]
  onDeleted: () => void
}

export function TaskActionBar({ task, projects, onDeleted }: TaskActionBarProps) {
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)
  const [breaking, setBreaking] = useState(false)
  const focusActive = useFocusStore((s) => s.isActive)

  const handleMove = useCallback(async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    try {
      await updateLocalTask({ id: task.id, projectId })
      taskToast(`Moved to ${project?.name ?? 'project'}`, task.id)
      emitTasksChanged()
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

  const handleFocus = useCallback(() => {
    // Open the focus play menu by dispatching to the store
    useFocusStore.getState().beginSetup(task)
  }, [task])

  // Menu variant — vertical list for popover
  return (
    <div className="flex flex-col">
      {/* Focus */}
      {!task.completed && !focusActive && (
        <MenuItem icon={Play} label="Start focus" onClick={handleFocus} />
      )}

      {/* Break down */}
      <MenuItem
        icon={Sparkles}
        label={breaking ? 'Breaking down...' : 'Break down with AI'}
        onClick={handleBreakDown}
        disabled={breaking}
      />

      {/* Move to project */}
      <div
        className="relative"
        onMouseEnter={() => setShowMoveSubmenu(true)}
        onMouseLeave={() => setShowMoveSubmenu(false)}
      >
        <MenuItem icon={FolderInput} label="Move to project" onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}>
          <ChevronRight className="size-3 text-muted-foreground/40 ml-auto" />
        </MenuItem>
        {showMoveSubmenu && (
          <div className="absolute left-full top-0 z-50 ml-1 animate-in fade-in slide-in-from-left-1 duration-100">
            <ProjectPickerMenu
              projects={projects}
              excludeProjectId={task.project_id}
              onSelect={handleMove}
            />
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="mx-1.5 my-1 border-t border-border/20" />

      {/* Delete */}
      <MenuItem
        icon={Trash2}
        label="Delete"
        onClick={handleDelete}
        className="text-destructive/60 hover:text-destructive"
      />
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  icon: typeof Trash2
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/20',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {children}
    </button>
  )
}
