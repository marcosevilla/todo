import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Trash2, FolderInput } from 'lucide-react'
import { FocusPlayMenu } from '@/components/focus/FocusPlayMenu'
import { useFocusStore } from '@/stores/focusStore'
import type { LocalTask, Project } from '@/services/tauri'

interface InboxTaskItemProps {
  task: LocalTask
  projects: Project[]
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, projectId: string) => void
}

export function InboxTaskItem({
  task,
  projects,
  onComplete,
  onUncomplete,
  onDelete,
  onMove,
}: InboxTaskItemProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [completing, setCompleting] = useState(false)

  const handleToggle = useCallback(() => {
    if (task.completed) {
      onUncomplete(task.id)
    } else {
      setCompleting(true)
      setTimeout(() => onComplete(task.id), 400)
    }
  }, [task, onComplete, onUncomplete])

  const otherProjects = projects.filter((p) => p.id !== task.project_id)

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2 transition-all',
        completing && 'opacity-50 scale-[0.98]',
        'hover:border-border/50 hover:bg-accent/10',
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={handleToggle}
        className="shrink-0"
      />

      <span className={cn(
        'flex-1 min-w-0 truncate text-sm',
        task.completed && 'text-muted-foreground line-through',
      )}>
        {task.content}
      </span>

      {/* Actions — always visible */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!task.completed && !useFocusStore.getState().isActive && (
          <FocusPlayMenu task={task} />
        )}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            title="Move to project"
          >
            <FolderInput className="size-3" />
          </Button>
          {showMoveMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="w-36 rounded-lg border border-border/50 bg-popover p-1 shadow-lg ring-1 ring-foreground/10">
                {otherProjects.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/20 transition-colors"
                    onClick={() => { onMove(task.id, p.id); setShowMoveMenu(false) }}
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
          size="icon-xs"
          onClick={() => onDelete(task.id)}
          className="text-destructive/60 hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  )
}
