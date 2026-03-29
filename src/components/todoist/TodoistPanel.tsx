import { useTodoist } from '@/hooks/useTodoist'
import { TaskRow } from './TaskRow'
import { Skeleton } from '@/components/ui/skeleton'

export function TodoistPanel() {
  const { tasks, error, loading, completeTask, snoozeTask, pendingActions } = useTodoist()

  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 h-9 px-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Retry
        </button>
      </div>
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
      {pendingActions.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          {pendingActions.length} action{pendingActions.length > 1 ? 's' : ''} pending sync
        </p>
      )}
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
