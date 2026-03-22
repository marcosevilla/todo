import { useCallback, useEffect, useState } from 'react'
import {
  fetchTodoistTasks,
  completeTodoistTask,
  snoozeTodoistTask,
} from '@/services/tauri'
import type { TodoistTaskRow } from '@/services/tauri'

export function useTodoist() {
  const [tasks, setTasks] = useState<TodoistTaskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchTodoistTasks()
      setTasks(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const completeTask = useCallback(
    async (taskId: string) => {
      // Optimistic: remove from list immediately
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      try {
        await completeTodoistTask(taskId)
      } catch (e) {
        // Revert on failure
        setError(String(e))
        refresh()
      }
    },
    [refresh],
  )

  const snoozeTask = useCallback(
    async (taskId: string) => {
      // Optimistic: remove from list (it's moving to tomorrow)
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      try {
        await snoozeTodoistTask(taskId)
      } catch (e) {
        setError(String(e))
        refresh()
      }
    },
    [refresh],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { tasks, error, loading, refresh, completeTask, snoozeTask }
}
