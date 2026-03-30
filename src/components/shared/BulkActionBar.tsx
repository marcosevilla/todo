import { useState, useCallback } from 'react'
import { useSelectionStore } from '@/stores/selectionStore'
import { useProjects } from '@/hooks/useLocalTasks'
import { deleteLocalTask, deleteCapture, updateTaskStatus, updateLocalTask, convertCaptureToTask } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ProjectPickerMenu } from './ProjectPickerMenu'
import { X, Trash2, ArrowRight, FolderInput } from 'lucide-react'
import { STATUSES } from '@/components/tasks/StatusDropdown'
import { playCompletionSound } from '@/lib/sound'
import type { TaskStatus } from '@/services/tauri'

export function BulkActionBar() {
  const hasSelection = useSelectionStore((s) => s.hasSelection)
  const count = useSelectionStore((s) => s.count)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const selectionType = useSelectionStore((s) => s.selectionType)
  const clear = useSelectionStore((s) => s.clear)

  const { projects } = useProjects()
  const [showStatus, setShowStatus] = useState(false)
  const [showMove, setShowMove] = useState(false)

  const handleDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    let deleted = 0
    for (const id of ids) {
      try {
        if (selectionType === 'task') await deleteLocalTask(id)
        else await deleteCapture(id)
        deleted++
      } catch { /* skip */ }
    }
    toast.success(`Deleted ${deleted} item${deleted !== 1 ? 's' : ''}`)
    emitTasksChanged()
    clear()
  }, [selectedIds, selectionType, clear])

  const handleSetStatus = useCallback(async (status: TaskStatus) => {
    if (selectionType !== 'task') return
    const ids = Array.from(selectedIds)
    if (status === 'complete') playCompletionSound()
    for (const id of ids) {
      try { await updateTaskStatus(id, status) } catch { /* skip */ }
    }
    toast.success(`Set ${ids.length} task${ids.length !== 1 ? 's' : ''} to ${status.replace('_', ' ')}`)
    emitTasksChanged()
    clear()
    setShowStatus(false)
  }, [selectedIds, selectionType, clear])

  const handleMove = useCallback(async (projectId: string) => {
    if (selectionType !== 'task') return
    const ids = Array.from(selectedIds)
    const project = projects.find((p) => p.id === projectId)
    for (const id of ids) {
      try { await updateLocalTask({ id, projectId }) } catch { /* skip */ }
    }
    toast.success(`Moved ${ids.length} task${ids.length !== 1 ? 's' : ''} to ${project?.name ?? 'project'}`)
    emitTasksChanged()
    clear()
    setShowMove(false)
  }, [selectedIds, selectionType, projects, clear])

  const handleConvertToTasks = useCallback(async () => {
    if (selectionType !== 'capture') return
    const ids = Array.from(selectedIds)
    let converted = 0
    for (const id of ids) {
      try { await convertCaptureToTask(id); converted++ } catch { /* skip */ }
    }
    toast.success(`Converted ${converted} note${converted !== 1 ? 's' : ''} to tasks`)
    emitTasksChanged()
    clear()
  }, [selectedIds, selectionType, clear])

  if (!hasSelection) return null

  return (
    <div className="fixed bottom-6 inset-x-0 z-30 flex justify-center bulk-action-bar-enter">
      <div className="flex items-center gap-1 rounded-xl border border-border/20 bg-popover px-2 py-1.5 shadow-lg shadow-black/5">
        {/* Count */}
        <span className="px-2 text-sm font-medium tabular-nums">
          {count} selected
        </span>

        <div className="mx-1 h-4 w-px bg-border/30" />

        {/* Task-specific actions */}
        {selectionType === 'task' && (
          <>
            {/* Set status */}
            <div className="relative">
              <ActionButton
                icon={STATUSES[1].icon}
                label="Status"
                onClick={() => { setShowStatus(!showStatus); setShowMove(false) }}
              />
              {showStatus && (
                <div className="absolute bottom-full left-0 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-100">
                  <div className="w-40 rounded-lg border border-border/30 bg-popover p-1 shadow-lg">
                    {STATUSES.map((s) => {
                      const SIcon = s.icon
                      return (
                        <button
                          key={s.value}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/20 transition-colors"
                          onClick={() => handleSetStatus(s.value)}
                        >
                          <SIcon className={cn('size-4', s.iconColor)} />
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Move to project */}
            <div className="relative">
              <ActionButton
                icon={FolderInput}
                label="Move"
                onClick={() => { setShowMove(!showMove); setShowStatus(false) }}
              />
              {showMove && (
                <div className="absolute bottom-full left-0 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-100">
                  <ProjectPickerMenu projects={projects} onSelect={handleMove} />
                </div>
              )}
            </div>
          </>
        )}

        {/* Note-specific actions */}
        {selectionType === 'capture' && (
          <ActionButton
            icon={ArrowRight}
            label="Convert to tasks"
            onClick={handleConvertToTasks}
          />
        )}

        {/* Delete (both types) */}
        <ActionButton
          icon={Trash2}
          label="Delete"
          onClick={handleDelete}
          className="text-destructive/60 hover:text-destructive"
        />

        <div className="mx-1 h-4 w-px bg-border/30" />

        {/* Clear */}
        <button
          onClick={clear}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
          title="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: typeof X
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors',
        className,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}
