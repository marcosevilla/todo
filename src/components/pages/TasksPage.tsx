import { useCallback, useMemo, useState } from 'react'
import { useLocalTasks, useProjects } from '@/hooks/useLocalTasks'
import { useTodoist } from '@/hooks/useTodoist'
import { LocalTaskRow } from '@/components/tasks/LocalTaskRow'
import { TaskRow } from '@/components/todoist/TaskRow'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Plus, FolderPlus } from 'lucide-react'
import { openUrl } from '@/services/tauri'

const PROJECT_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#f43f5e', '#8b5cf6', '#14b8a6',
]

// ── Inline Task Creator ──

function TaskCreator({
  projectId,
  onAdd,
}: {
  projectId: string
  onAdd: (content: string, extra?: { projectId?: string; dueDate?: string; priority?: number }) => void
}) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const text = value.trim()
    if (!text) return
    onAdd(text, { projectId })
    setValue('')
  }

  return (
    <div className="flex items-center gap-2 py-1 pl-2">
      <Plus className="size-3.5 text-muted-foreground/40 shrink-0" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        placeholder="Add a task..."
        className="h-7 text-sm border-none shadow-none bg-transparent px-0 focus-visible:ring-0"
      />
    </div>
  )
}

// ── New Project Dialog ──

function NewProjectInput({ onAdd }: { onAdd: (name: string, color: string) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <FolderPlus className="size-3.5" />
        New project
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) {
            onAdd(name.trim(), color)
            setName('')
            setOpen(false)
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Project name"
        className="h-7 text-sm"
        autoFocus
      />
      <div className="flex items-center gap-1.5">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            className={cn(
              'size-5 rounded-full border-2 transition-all',
              color === c ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50',
            )}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { if (name.trim()) { onAdd(name.trim(), color); setName(''); setOpen(false) } }}>
          Create
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Project Section ──

function ProjectSection({
  projectName,
  projectColor,
  projectId,
  tasks,
  onAddTask,
  onComplete,
  onUncomplete,
  onDelete,
  onAddSubtask,
  onDeleteProject,
  onUpdated,
  allProjects,
  defaultOpen,
}: {
  projectName: string
  projectColor: string
  projectId: string
  tasks: { id: string; parent_id: string | null }[] & any[]
  onAddTask: (content: string, extra?: { projectId?: string }) => void
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onDelete: (id: string) => void
  onAddSubtask: (parentId: string, content: string) => void
  onDeleteProject?: () => void
  onUpdated?: () => void
  allProjects: import('@/services/tauri').Project[]
  defaultOpen: boolean
}) {
  // Separate top-level tasks and subtasks
  const topLevel = tasks.filter((t: any) => !t.parent_id)
  const subtaskMap = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const t of tasks) {
      if (t.parent_id) {
        if (!map[t.parent_id]) map[t.parent_id] = []
        map[t.parent_id].push(t)
      }
    }
    return map
  }, [tasks])

  return (
    <CollapsibleSection
      title={projectName}
      count={topLevel.filter((t: any) => !t.completed).length}
      defaultOpen={defaultOpen}
      variant="nested"
      icon={
        <span
          className="size-2.5 rounded-full shrink-0"
          style={{ backgroundColor: projectColor }}
        />
      }
    >
      <div className="space-y-0.5">
        {topLevel.map((task: any) => (
          <LocalTaskRow
            key={task.id}
            task={task}
            subtasks={subtaskMap[task.id] || []}
            projects={allProjects}
            projectName={projectName}
            projectColor={projectColor}
            onComplete={onComplete}
            onUncomplete={onUncomplete}
            onDelete={onDelete}
            onAddSubtask={onAddSubtask}
            onUpdated={onUpdated ? () => onUpdated() : undefined}
          />
        ))}
        <TaskCreator projectId={projectId} onAdd={onAddTask} />
      </div>
    </CollapsibleSection>
  )
}

// ── Tasks Page ──

export function TasksPage() {
  const { projects, loading: projectsLoading, addProject, removeProject } = useProjects()
  const { tasks, loading: tasksLoading, addTask, complete, uncomplete, remove, refresh } = useLocalTasks()
  const { tasks: todoistTasks, loading: todoistLoading, completeTask: completeTodoist, snoozeTask: snoozeTodoist } = useTodoist()

  const loading = projectsLoading || tasksLoading

  const handleAddSubtask = useCallback(
    async (parentId: string, content: string) => {
      // Find the parent's project
      const parent = tasks.find((t) => t.id === parentId)
      await addTask(content, { parentId, projectId: parent?.project_id })
      refresh()
    },
    [tasks, addTask, refresh],
  )

  const handleAddTask = useCallback(
    async (content: string, extra?: { projectId?: string }) => {
      await addTask(content, extra)
    },
    [addTask],
  )

  if (loading) {
    return (
      <div className="space-y-3 p-1">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    )
  }

  // Group tasks by project
  const tasksByProject: Record<string, typeof tasks> = {}
  for (const task of tasks) {
    if (!tasksByProject[task.project_id]) tasksByProject[task.project_id] = []
    tasksByProject[task.project_id].push(task)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">All Tasks</h2>
          <span className="text-xs text-muted-foreground">
            {tasks.filter((t) => !t.completed).length} open across {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Project sections */}
      {projects.map((project) => (
        <ProjectSection
          key={project.id}
          projectName={project.name}
          projectColor={project.color}
          projectId={project.id}
          tasks={tasksByProject[project.id] || []}
          onAddTask={handleAddTask}
          onComplete={complete}
          onUncomplete={uncomplete}
          onDelete={remove}
          onAddSubtask={handleAddSubtask}
          onDeleteProject={project.id !== 'inbox' ? () => removeProject(project.id) : undefined}
          onUpdated={refresh}
          allProjects={projects}
          defaultOpen={true}
        />
      ))}

      {/* New project */}
      <div className="pt-2">
        <NewProjectInput onAdd={addProject} />
      </div>

      {/* Todoist — read-only, collapsed by default */}
      {!todoistLoading && todoistTasks.length > 0 && (
        <CollapsibleSection
          title="Todoist"
          count={todoistTasks.length}
          defaultOpen={false}
          variant="nested"
          icon={<span className="size-2.5 rounded-full shrink-0 bg-red-500" />}
        >
          <div className="space-y-0.5">
            {todoistTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={completeTodoist}
                onSnooze={snoozeTodoist}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
