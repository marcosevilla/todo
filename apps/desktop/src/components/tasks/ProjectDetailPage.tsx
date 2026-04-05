import { useCallback, useMemo, useState } from 'react'
import { SortableTaskList } from '@/components/tasks/SortableTaskList'
import { STATUSES } from '@/components/tasks/StatusDropdown'
import { cn } from '@/lib/utils'
import { ArrowLeft, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Project, LocalTask, TaskStatus } from '@/services/tauri'

// ── Inline Task Creator ──

function TaskCreator({
  projectId,
  onAdd,
}: {
  projectId: string
  onAdd: (content: string, extra?: { projectId?: string }) => void
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

interface ProjectDetailPageProps {
  project: Project
  tasks: LocalTask[]
  allProjects: Project[]
  onBack: () => void
  onAddTask: (content: string, extra?: { projectId?: string }) => void
  onDeleteTask: (id: string) => void
  onAddSubtask: (parentId: string, content: string) => void
  onUpdated: () => void
}

export function ProjectDetailPage({
  project,
  tasks,
  allProjects,
  onBack,
  onAddTask,
  onDeleteTask,
  onAddSubtask,
  onUpdated,
}: ProjectDetailPageProps) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')

  const projectTasks = useMemo(() => {
    return tasks.filter((t) => t.project_id === project.id)
  }, [tasks, project.id])

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return projectTasks
    return projectTasks.filter((t) => t.status === statusFilter)
  }, [projectTasks, statusFilter])

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projectTasks.length }
    for (const t of projectTasks) {
      counts[t.status] = (counts[t.status] || 0) + 1
    }
    return counts
  }, [projectTasks])

  const topLevelCount = projectTasks.filter((t) => !t.parent_id && !t.completed).length

  const handleAddSubtask = useCallback(
    async (parentId: string, content: string) => {
      onAddSubtask(parentId, content)
    },
    [onAddSubtask],
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {/* Back + Header */}
        <div className="space-y-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors -ml-1"
          >
            <ArrowLeft className="size-3" />
            All Tasks
          </button>

          <div className="flex items-center gap-3">
            <span
              className="size-3.5 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <h2 className="font-heading text-lg font-semibold">{project.name}</h2>
            <span className="text-xs text-muted-foreground">
              {topLevelCount} active task{topLevelCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
            <span>Project</span>
            {project.id === 'inbox' && (
              <span className="rounded bg-muted/30 px-1.5 py-0.5">Default inbox</span>
            )}
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              statusFilter === 'all'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20',
            )}
          >
            All
            <span className="ml-1 text-[10px] opacity-60">{statusCounts.all || 0}</span>
          </button>
          {STATUSES.map((s) => {
            const SIcon = s.icon
            const count = statusCounts[s.value] || 0
            if (count === 0 && statusFilter !== s.value) return null
            return (
              <button
                key={s.value}
                onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  statusFilter === s.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20',
                )}
              >
                <SIcon className={cn('size-3', statusFilter === s.value ? '' : s.iconColor)} />
                {s.label}
                <span className="text-[10px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {statusFilter === 'all'
              ? 'No tasks in this project yet.'
              : `No ${statusFilter.replace('_', ' ')} tasks.`}
          </p>
        ) : (
          <SortableTaskList
            tasks={filteredTasks}
            allTasks={filteredTasks}
            projects={allProjects}
            projectName={project.name}
            projectColor={project.color}
            onDelete={onDeleteTask}
            onAddSubtask={handleAddSubtask}
            onUpdated={onUpdated}
          />
        )}

        {/* Inline task creator */}
        <TaskCreator projectId={project.id} onAdd={onAddTask} />
      </div>
    </div>
  )
}
