import { useCallback, useEffect, useState } from 'react'
import { useProjects } from '@/hooks/useLocalTasks'
import { createLocalTask } from '@/services/tauri'
import { toast } from 'sonner'
import { taskToast } from '@/lib/taskToast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Normal', color: 'bg-muted text-muted-foreground' },
  { value: 2, label: 'Medium', color: 'bg-accent-blue/10 text-accent-blue' },
  { value: 3, label: 'High', color: 'bg-orange-500/10 text-orange-500' },
  { value: 4, label: 'Urgent', color: 'bg-red-500/10 text-red-500' },
]

interface QuickCreateDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function QuickCreateDialog({ open, onClose, onCreated }: QuickCreateDialogProps) {
  const { projects } = useProjects()
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('inbox')
  const [priority, setPriority] = useState(1)
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setContent('')
      setDescription('')
      setProjectId('inbox')
      setPriority(1)
      setDueDate('')
    }
  }, [open])

  const handleSubmit = useCallback(async () => {
    const text = content.trim()
    if (!text || submitting) return

    setSubmitting(true)
    try {
      const task = await createLocalTask({
        content: text,
        projectId,
        priority,
        dueDate: dueDate || undefined,
        description: description.trim() || undefined,
      })
      taskToast('Task created', task.id)
      onClose()
      onCreated?.()
    } catch (e) {
      toast.error(`Failed to create task: ${e}`)
    } finally {
      setSubmitting(false)
    }
  }, [content, projectId, priority, dueDate, submitting, onClose, onCreated])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription className="sr-only">Create a new task</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Task content */}
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="What needs to be done?"
            className="text-sm"
            autoFocus
          />

          {/* Description */}
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description (optional)"
            className="text-sm min-h-[60px]"
          />

          {/* Project picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Project</label>
            <div className="flex flex-wrap gap-1.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProjectId(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                    projectId === p.id
                      ? 'border-foreground/20 bg-accent text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-accent/50',
                  )}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Priority</label>
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs transition-colors',
                    priority === opt.value
                      ? opt.color
                      : 'text-muted-foreground hover:bg-accent/50',
                    priority === opt.value && 'ring-1 ring-current/20',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Due date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm w-auto"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
