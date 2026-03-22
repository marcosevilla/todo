import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
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
  const setTodoistTasks = useAppStore((s) => s.setTodoistTasks)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchTodoistTasks()
      setTasks(data)
      // Store in Zustand for priorities hook
      setTodoistTasks(data.map((t) => ({
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
      })))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [setTodoistTasks])

  const completeTask = useCallback(
    async (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      try {
        await completeTodoistTask(taskId)
      } catch (e) {
        setError(String(e))
        refresh()
      }
    },
    [refresh],
  )

  const snoozeTask = useCallback(
    async (taskId: string) => {
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
