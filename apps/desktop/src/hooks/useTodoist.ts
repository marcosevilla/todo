import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useDataProvider } from '@/services/provider-context'
import type { TodoistTaskRow } from '@daily-triage/types'
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
  const dp = useDataProvider()
  const [tasks, setTasks] = useState<TodoistTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const [, setMigratedIds] = useState<Set<string>>(() => new Set())
  const setTodoistTasks = useAppStore((s) => s.setTodoistTasks)
  const mountedRef = useRef(true)
  const savedTasksRef = useRef<TodoistTaskRow[]>([])

  // Apply fetched data to local + store state. Tasks that already exist
  // locally (imported via the Todoist migration) are filtered out so the
  // user doesn't see duplicates in the Todoist panel.
  const applyData = useCallback(
    (data: TodoistTaskRow[], migrated: Set<string>) => {
      if (!mountedRef.current) return
      const filtered = migrated.size > 0
        ? data.filter((t) => !migrated.has(t.id))
        : data
      setTasks(filtered)
      savedTasksRef.current = filtered
      setTodoistTasks(toStoreTasks(filtered))
    },
    [setTodoistTasks],
  )

  // Replay pending actions after a successful refresh
  const replayPendingActions = useCallback(async (actions: PendingAction[]) => {
    const stillPending: PendingAction[] = []
    for (const action of actions) {
      try {
        if (action.type === 'complete') {
          await dp.todoist.completeTask(action.taskId)
        } else {
          await dp.todoist.snoozeTask(action.taskId)
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
  }, [dp])

  // Manual refresh — hits the API directly
  const refresh = useCallback(async () => {
    try {
      setError(null)
      const [data, migrated] = await Promise.all([
        dp.todoist.refreshTasks(),
        dp.todoist.migratedIds().catch(() => [] as string[]),
      ])
      const migratedSet = new Set(migrated)
      setMigratedIds(migratedSet)
      applyData(data, migratedSet)
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
  }, [dp, applyData, replayPendingActions])

  // On mount: load from cache first, then silently refresh from API
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    async function loadCacheThenRefresh() {
      // Fetch migrated IDs first so the cached + fresh pass both filter.
      const migrated = await dp.todoist.migratedIds().catch(() => [] as string[])
      const migratedSet = new Set(migrated)
      if (!cancelled) setMigratedIds(migratedSet)

      // Step 1: Load cached data instantly
      try {
        const cached = await dp.todoist.fetchTasks()
        if (cancelled) return
        applyData(cached, migratedSet)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(friendlyError(e))
        setLoading(false)
      }

      // Step 2: Silently refresh from API in the background. Re-fetch
      // the migrated set too — it may have changed since mount.
      try {
        const [fresh, freshMigrated] = await Promise.all([
          dp.todoist.refreshTasks(),
          dp.todoist.migratedIds().catch(() => [] as string[]),
        ])
        if (cancelled) return
        const freshSet = new Set(freshMigrated)
        setMigratedIds(freshSet)
        applyData(fresh, freshSet)
      } catch {
        // Silently fail — cached data is already showing
      }
    }

    loadCacheThenRefresh()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [dp, applyData])

  const completeTask = useCallback(
    async (taskId: string) => {
      // Optimistic update — remove from UI immediately
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      try {
        await retryOnce(() => dp.todoist.completeTask(taskId))
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
    [dp],
  )

  const snoozeTask = useCallback(
    async (taskId: string) => {
      // Optimistic update — remove from UI immediately
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      try {
        await retryOnce(() => dp.todoist.snoozeTask(taskId))
      } catch (e) {
        // Retry failed — queue the action and show a toast
        const msg = friendlyError(e)
        setError(msg)
        toast.error(msg)
        setPendingActions((prev) => [...prev, { type: 'snooze', taskId }])
      }
    },
    [dp],
  )

  return { tasks, error, loading, refresh, completeTask, snoozeTask, pendingActions }
}
