import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Circle, CircleDot, Loader, Ban, CheckCircle2 } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { updateTaskStatus } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { playCompletionSound } from '@/lib/sound'
import { toast } from 'sonner'
import type { TaskStatus } from '@/services/tauri'
import type { LucideIcon } from 'lucide-react'

export interface StatusConfig {
  value: TaskStatus
  label: string
  icon: LucideIcon
  color: string
  iconColor: string
}

export const STATUSES: StatusConfig[] = [
  { value: 'backlog', label: 'Backlog', icon: Circle, color: 'text-muted-foreground/50', iconColor: 'text-muted-foreground/50' },
  { value: 'todo', label: 'Todo', icon: CircleDot, color: 'text-blue-500', iconColor: 'text-blue-500' },
  { value: 'in_progress', label: 'In Progress', icon: Loader, color: 'text-amber-500', iconColor: 'text-amber-500' },
  { value: 'blocked', label: 'Blocked', icon: Ban, color: 'text-red-500', iconColor: 'text-red-500' },
  { value: 'complete', label: 'Complete', icon: CheckCircle2, color: 'text-green-500', iconColor: 'text-green-500' },
]

export function getStatusConfig(status: TaskStatus): StatusConfig {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[1]
}

interface StatusDropdownProps {
  taskId: string
  status: TaskStatus
  size?: 'sm' | 'md'
}

export function StatusDropdown({ taskId, status, size = 'sm' }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [showBlockedInput, setShowBlockedInput] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')

  const current = getStatusConfig(status)
  const Icon = current.icon

  const handleSelect = useCallback(async (newStatus: TaskStatus) => {
    if (newStatus === status) { setOpen(false); return }

    if (newStatus === 'blocked') {
      setShowBlockedInput(true)
      return
    }

    if (newStatus === 'complete') playCompletionSound()

    try {
      await updateTaskStatus(taskId, newStatus)
      emitTasksChanged()
    } catch (e) {
      toast.error(`Failed to update status: ${e}`)
    }
    setOpen(false)
  }, [taskId, status])

  const handleBlockedSubmit = useCallback(async () => {
    try {
      await updateTaskStatus(taskId, 'blocked', blockedReason.trim() || undefined)
      emitTasksChanged()
    } catch (e) {
      toast.error(`Failed to update status: ${e}`)
    }
    setShowBlockedInput(false)
    setBlockedReason('')
    setOpen(false)
  }, [taskId, blockedReason])

  const iconSize = size === 'md' ? 'size-5' : 'size-4'

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShowBlockedInput(false); setBlockedReason('') } }}>
      <PopoverTrigger
        className={cn(
          'shrink-0 rounded-md transition-colors hover:bg-accent/20',
          size === 'md' ? 'p-0.5' : 'p-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className={cn(iconSize, current.iconColor)} />
      </PopoverTrigger>

      <PopoverContent side="bottom" align="start" sideOffset={4} className="w-44 gap-0 p-1">
        {showBlockedInput ? (
          <div className="p-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Why is this blocked?</p>
            <Input
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleBlockedSubmit() }
                if (e.key === 'Escape') { e.preventDefault(); setShowBlockedInput(false) }
              }}
              placeholder="Waiting on..."
              className="h-7 text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => setShowBlockedInput(false)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/20"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockedSubmit}
                className="rounded-md bg-foreground px-2 py-1 text-xs text-background font-medium"
              >
                Set blocked
              </button>
            </div>
          </div>
        ) : (
          STATUSES.map((s) => {
            const SIcon = s.icon
            return (
              <button
                key={s.value}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  s.value === status ? 'bg-accent/40' : 'hover:bg-accent/20',
                )}
                onClick={() => handleSelect(s.value)}
              >
                <SIcon className={cn('size-4', s.iconColor)} />
                <span>{s.label}</span>
              </button>
            )
          })
        )}
      </PopoverContent>
    </Popover>
  )
}
