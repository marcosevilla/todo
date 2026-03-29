import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useLocalTasks, useProjects } from '@/hooks/useLocalTasks'
import { updateLocalTask, logActivity, createLocalTask } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { CapturesPanel } from '@/components/obsidian/CapturesPanel'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { InboxTaskItem } from '@/components/tasks/InboxTaskItem'
import { Lightbulb, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'

export function InboxPage() {
  const captureRequested = useAppStore((s) => s.captureRequested)
  const setCaptureRequested = useAppStore((s) => s.setCaptureRequested)

  const { tasks, loading, complete, uncomplete, remove, refresh } = useLocalTasks({ projectId: 'inbox' })
  const { projects } = useProjects()

  const incompleteTasks = tasks.filter((t) => !t.completed && !t.parent_id)

  // Clear the flag after consuming it
  useEffect(() => {
    if (captureRequested) {
      const timer = setTimeout(() => setCaptureRequested(false), 100)
      return () => clearTimeout(timer)
    }
  }, [captureRequested, setCaptureRequested])

  const handleMove = useCallback(async (id: string, projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    try {
      await updateLocalTask({ id, projectId })
      toast.success(`Moved to ${project?.name ?? 'project'}`)
      emitTasksChanged()
    } catch (e) {
      toast.error(`Failed to move: ${e}`)
    }
  }, [projects, refresh])

  const handleConvertCapture = useCallback(async (content: string) => {
    try {
      await createLocalTask({ content })
      logActivity('capture_converted', undefined, { content }).catch(() => {})
      toast.success(`Task created: "${content}"`)
      emitTasksChanged()
    } catch (e) {
      toast.error(`Failed to create task: ${e}`)
    }
  }, [refresh])

  return (
    <div className="space-y-4">
      {/* Native inbox tasks */}
      {!loading && incompleteTasks.length > 0 && (
        <CollapsibleSection
          title="Tasks"
          icon={<CheckSquare size={14} className="text-muted-foreground" />}
          count={incompleteTasks.length}
          defaultOpen={true}
        >
          <div className="space-y-1.5">
            {incompleteTasks.map((task) => (
              <InboxTaskItem
                key={task.id}
                task={task}
                projects={projects}
                onComplete={complete}
                onUncomplete={uncomplete}
                onDelete={remove}
                onMove={handleMove}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Obsidian captures */}
      <CollapsibleSection
        title="Quick Captures"
        icon={<Lightbulb size={14} className="text-muted-foreground" />}
        defaultOpen={true}
      >
        <CapturesPanel autoFocus={captureRequested} onConvertToTask={handleConvertCapture} />
      </CollapsibleSection>
    </div>
  )
}
