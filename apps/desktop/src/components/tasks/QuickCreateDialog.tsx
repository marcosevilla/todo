import { useCallback, useEffect, useState } from 'react'
import { useProjects } from '@/hooks/useLocalTasks'
import { useDataProvider } from '@/services/provider-context'
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
import { PriorityBars } from '@/components/shared/PriorityBars'
import { cn } from '@/lib/utils'

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Normal' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
  { value: 4, label: 'Urgent' },
]

interface QuickCreateDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function QuickCreateDialog({ open, onClose, onCreated }: QuickCreateDialogProps) {
  const dp = useDataProvider()
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
      const task = await dp.tasks.create({
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
  }, [content, projectId, priority, dueDate, submitting, onClose, onCreated, dp])

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
            className="text-body"
            autoFocus
          />

          {/* Description */}
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description (optional)"
            className="text-body min-h-[60px]"
          />

          {/* Project picker */}
          <div className="space-y-1.5">
            <label className="text-label text-muted-foreground">Project</label>
            <div className="flex flex-wrap gap-1.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProjectId(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-meta transition-colors',
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
            <label className="text-label text-muted-foreground">Priority</label>
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-meta transition-colors',
                    priority === opt.value
                      ? 'bg-accent/40 text-foreground ring-1 ring-border/40'
                      : 'text-muted-foreground hover:bg-accent/20',
                  )}
                >
                  <PriorityBars priority={opt.value} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-label text-muted-foreground">Due date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-body w-auto"
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
