import { useCallback, useEffect, useState } from 'react'
import { updateLocalTask } from '@/services/tauri'
import type { LocalTask, Project } from '@/services/tauri'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { X } from 'lucide-react'

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Normal', color: 'text-muted-foreground' },
  { value: 2, label: 'Medium', color: 'text-accent-blue' },
  { value: 3, label: 'High', color: 'text-orange-500' },
  { value: 4, label: 'Urgent', color: 'text-red-500' },
]

interface TaskEditorProps {
  task: LocalTask
  projects: Project[]
  onClose: () => void
  onUpdated: (task: LocalTask) => void
}

export function TaskEditor({ task, projects, onClose, onUpdated }: TaskEditorProps) {
  const [content, setContent] = useState(task.content)
  const [description, setDescription] = useState(task.description ?? '')
  const [projectId, setProjectId] = useState(task.project_id)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Track changes
  useEffect(() => {
    const changed =
      content !== task.content ||
      description !== (task.description ?? '') ||
      projectId !== task.project_id ||
      priority !== task.priority ||
      dueDate !== (task.due_date ?? '')
    setDirty(changed)
  }, [content, description, projectId, priority, dueDate, task])

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      const updated = await updateLocalTask({
        id: task.id,
        content: content.trim() || undefined,
        description: description.trim() || undefined,
        projectId: projectId !== task.project_id ? projectId : undefined,
        priority: priority !== task.priority ? priority : undefined,
        dueDate: dueDate || undefined,
        clearDueDate: !dueDate && !!task.due_date,
      })
      onUpdated(updated)
      onClose()
    } catch (e) {
      toast.error(`Failed to update: ${e}`)
    } finally {
      setSaving(false)
    }
  }, [dirty, saving, task, content, description, projectId, priority, dueDate, onUpdated, onClose])

  // Save on Cmd+Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [handleSave, onClose],
  )

  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">Edit task</span>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="size-3" />
        </Button>
      </div>

      {/* Title */}
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="text-sm font-medium"
        placeholder="Task name"
      />

      {/* Description */}
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add a description..."
        className="text-sm min-h-[60px]"
      />

      {/* Metadata row */}
      <div className="flex flex-wrap gap-4">
        {/* Priority */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Priority</label>
          <div className="flex gap-1">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPriority(opt.value)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] transition-colors',
                  priority === opt.value
                    ? cn(opt.color, 'bg-current/10 font-medium')
                    : 'text-muted-foreground hover:bg-accent/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Due date</label>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-7 text-xs w-auto"
            />
            {dueDate && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDueDate('')}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Project */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Project</label>
          <div className="flex flex-wrap gap-1">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectId(p.id)}
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors',
                  projectId === p.id
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50',
                )}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">
          {dirty ? '⌘Enter to save' : 'No changes'}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
