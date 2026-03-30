import { useCallback, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LocalTaskRow } from './LocalTaskRow'
import { reorderLocalTasks } from '@/services/tauri'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LocalTask, Project } from '@/services/tauri'

interface SortableTaskItemProps {
  task: LocalTask
  subtasks: LocalTask[]
  projects: Project[]
  projectName?: string
  projectColor?: string
  onDelete: (id: string) => void
  onAddSubtask: (parentId: string, content: string) => void
  onUpdated?: () => void
}

function SortableTaskItem({
  task,
  subtasks,
  projects,
  projectName,
  projectColor,
  onDelete,
  onAddSubtask,
  onUpdated,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex items-start',
        isDragging && 'z-10 opacity-80 bg-accent/30 rounded-md',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-2.5 mr-0.5 shrink-0 cursor-grab text-muted-foreground/20 hover:text-muted-foreground/60 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>

      <div className="flex-1 min-w-0">
        <LocalTaskRow
          task={task}
          subtasks={subtasks}
          projects={projects}
          projectName={projectName}
          projectColor={projectColor}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
          onUpdated={onUpdated}
        />
      </div>
    </div>
  )
}

interface SortableTaskListProps {
  tasks: LocalTask[]
  allTasks: LocalTask[]
  projects: Project[]
  projectName?: string
  projectColor?: string
  onDelete: (id: string) => void
  onAddSubtask: (parentId: string, content: string) => void
  onUpdated?: () => void
}

export function SortableTaskList({
  tasks,
  allTasks,
  projects,
  projectName,
  projectColor,
  onDelete,
  onAddSubtask,
  onUpdated,
}: SortableTaskListProps) {
  const topLevel = tasks.filter((t) => !t.parent_id)
  const [items, setItems] = useState(topLevel.map((t) => t.id))

  // Update items when tasks change externally
  const currentIds = topLevel.map((t) => t.id).join(',')
  const [prevIds, setPrevIds] = useState(currentIds)
  if (currentIds !== prevIds) {
    setItems(topLevel.map((t) => t.id))
    setPrevIds(currentIds)
  }

  // Build subtask map
  const subtaskMap: Record<string, LocalTask[]> = {}
  for (const t of allTasks) {
    if (t.parent_id) {
      if (!subtaskMap[t.parent_id]) subtaskMap[t.parent_id] = []
      subtaskMap[t.parent_id].push(t)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.indexOf(active.id as string)
      const newIndex = items.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      const newItems = [...items]
      newItems.splice(oldIndex, 1)
      newItems.splice(newIndex, 0, active.id as string)
      setItems(newItems)

      // Persist new order
      try {
        await reorderLocalTasks(newItems)
      } catch {
        // Revert on failure
        setItems(items)
      }
    },
    [items],
  )

  const taskMap: Record<string, LocalTask> = {}
  for (const t of topLevel) taskMap[t.id] = t

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {items.map((id) => {
            const task = taskMap[id]
            if (!task) return null
            return (
              <SortableTaskItem
                key={id}
                task={task}
                subtasks={subtaskMap[id] || []}
                projects={projects}
                projectName={projectName}
                projectColor={projectColor}
                onDelete={onDelete}
                onAddSubtask={onAddSubtask}
                onUpdated={onUpdated}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
