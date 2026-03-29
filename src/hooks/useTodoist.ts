import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import {
  fetchTodoistTasks,
  refreshTodoistTasks,
  completeTodoistTask,
  snoozeTodoistTask,
} from '@/services/tauri'
import type { TodoistTaskRow } from '@/services/tauri'
import { friendlyError, retryOnce } from '@/lib/errors'
import { toast } from 'sonner'

interface PendingAction {
  type: 'complete' | 'snooze'
  taskId: string
}

function toStoreTasks(data: TodoistTaskRow[]) {
  return data.map((t) => ({
    id: t.id,
    content: t.content,
    description: t.description,
    project_id: t.project_id,
    project_name: t.project_name,
    priority: t.priority,
    due_date: t.due_date,
    due_is_recurring: !!t.due_is_recurring,
    is_completed: !!t.is_completed,
    todoist_url: t.todoist_url,
  }))
}

export function useTodoist() {
  const [tasks, setTasks] = useState<TodoistTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const setTodoistTasks = useAppStore((s) => s.setTodoistTasks)
  const mountedRef = useRef(true)
  const savedTasksRef = useRef<TodoistTaskRow[]>([])

  // Apply fetched data to local + store state
  const applyData = useCallback(
    (data: TodoistTaskRow[]) => {
      if (!mountedRef.current) return
      setTasks(data)
      savedTasksRef.current = data
      setTodoistTasks(toStoreTasks(data))
    },
    [setTodoistTasks],
  )

  // Replay pending actions after a successful refresh
  const replayPendingActions = useCallback(async (actions: PendingAction[]) => {
    const stillPending: PendingAction[] = []
    for (const action of actions) {
      try {
        if (action.type === 'complete') {
          await completeTodoistTask(action.taskId)
        } else {
          await snoozeTodoistTask(action.taskId)
        }
      } catch {
        stillPending.push(action)
      }
    }
    if (mountedRef.current) {
      setPendingActions(stillPending)
      if (stillPending.length === 0 && actions.length > 0) {
        toast.success('Pending actions synced successfully')
      }
    }
  }, [])

  // Manual refresh — hits the API directly
  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await refreshTodoistTasks()
      applyData(data)
      // After successful refresh, try to replay pending actions
      setPendingActions((prev) => {
        if (prev.length > 0) {
          replayPendingActions(prev)
        }
        return prev
      })
    } catch (e) {
      if (mountedRef.current) setError(friendlyError(e))
    }
  }, [applyData, replayPendingActions])

  // On mount: load from cache first, then silently refresh from API
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    async function loadCacheThenRefresh() {
      // Step 1: Load cached data instantly
      try {
        const cached = await fetchTodoistTasks()
        if (cancelled) return
        applyData(cached)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(friendlyError(e))
        setLoading(false)
      }

      // Step 2: Silently refresh from API in the background
      try {
        const fresh = await refreshTodoistTasks()
        if (cancelled) return
        applyData(fresh)
      } catch {
        // Silently fail — cached data is already showing
      }
    }

    loadCacheThenRefresh()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [applyData])

  const completeTask = useCallback(
    async (taskId: string) => {
      // Optimistic update — remove from UI immediately
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      try {
        await retryOnce(() => completeTodoistTask(taskId))
      } catch (e) {
        // Retry failed — queue the action and show a toast
        const msg = friendlyError(e)
        setError(msg)
        toast.error(msg)
        setPendingActions((prev) => [...prev, { type: 'complete', taskId }])
        // Don't restore the task to UI — keep optimistic update,
        // the pending queue will sync it on next refresh
      }
    },
    [],
  )

  const snoozeTask = useCallback(
    async (taskId: string) => {
      // Optimistic update — remove from UI immediately
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      try {
        await retryOnce(() => snoozeTodoistTask(taskId))
      } catch (e) {
        // Retry failed — queue the action and show a toast
        const msg = friendlyError(e)
        setError(msg)
        toast.error(msg)
        setPendingActions((prev) => [...prev, { type: 'snooze', taskId }])
      }
    },
    [],
  )

  return { tasks, error, loading, refresh, completeTask, snoozeTask, pendingActions }
}
