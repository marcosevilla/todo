import { useTodoist } from '@/hooks/useTodoist'
import { TaskRow } from './TaskRow'

export function TodoistPanel() {
  const { tasks, error, loading, completeTask, snoozeTask } = useTodoist()

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load tasks: {error}
      </p>
    )
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing due today. Nice.
      </p>
    )
  }

  return (
    <div className="space-y-0.5">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onComplete={completeTask}
          onSnooze={snoozeTask}
        />
      ))}
    </div>
  )
}
