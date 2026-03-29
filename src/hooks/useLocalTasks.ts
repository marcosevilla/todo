import { useCallback, useEffect, useState } from 'react'
import {
  getLocalTasks,
  createLocalTask,
  completeLocalTask,
  uncompleteLocalTask,
  deleteLocalTask,
  getProjects,
  createProject,
  deleteProject,
} from '@/services/tauri'
import type { LocalTask, Project } from '@/services/tauri'
import { toast } from 'sonner'

export function useLocalTasks(opts?: { projectId?: string; dueDate?: string }) {
  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await getLocalTasks({
        projectId: opts?.projectId,
        dueDate: opts?.dueDate,
      })
      setTasks(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [opts?.projectId, opts?.dueDate])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addTask = useCallback(
    async (content: string, extra?: { parentId?: string; projectId?: string; priority?: number; dueDate?: string; description?: string }) => {
      try {
        const task = await createLocalTask({
          content,
          projectId: extra?.projectId ?? opts?.projectId,
          parentId: extra?.parentId,
          priority: extra?.priority,
          dueDate: extra?.dueDate,
          description: extra?.description,
        })
        setTasks((prev) => [...prev, task])
        return task
      } catch (e) {
        toast.error(`Failed to create task: ${e}`)
        return null
      }
    },
    [opts?.projectId],
  )

  const complete = useCallback(async (id: string) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id || t.parent_id === id
          ? { ...t, completed: true, completed_at: new Date().toISOString() }
          : t,
      ),
    )
    try {
      await completeLocalTask(id)
    } catch (e) {
      toast.error(`Failed to complete task: ${e}`)
      refresh()
    }
  }, [refresh])

  const uncomplete = useCallback(async (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: false, completed_at: null } : t,
      ),
    )
    try {
      await uncompleteLocalTask(id)
    } catch (e) {
      toast.error(`Failed to uncomplete task: ${e}`)
      refresh()
    }
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parent_id !== id))
    try {
      await deleteLocalTask(id)
    } catch (e) {
      toast.error(`Failed to delete task: ${e}`)
      refresh()
    }
  }, [refresh])

  return { tasks, loading, error, refresh, addTask, complete, uncomplete, remove }
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getProjects()
      setProjects(data)
    } catch {
      // Silently fail — table may not exist on first run before migration
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addProject = useCallback(async (name: string, color: string) => {
    try {
      const project = await createProject(name, color)
      setProjects((prev) => [...prev, project])
      return project
    } catch (e) {
      toast.error(`Failed to create project: ${e}`)
      return null
    }
  }, [])

  const renameProject = useCallback(async (id: string, name: string) => {
    try {
      await import('@/services/tauri').then((m) => m.updateProject(id, name))
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name } : p))
    } catch (e) {
      toast.error(`Failed to rename project: ${e}`)
    }
  }, [])

  const updateProjectColor = useCallback(async (id: string, color: string) => {
    try {
      await import('@/services/tauri').then((m) => m.updateProject(id, undefined, color))
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, color } : p))
    } catch (e) {
      toast.error(`Failed to update color: ${e}`)
    }
  }, [])

  const removeProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      toast.error(`Failed to delete project: ${e}`)
    }
  }, [])

  return { projects, loading, refresh, addProject, renameProject, updateProjectColor, removeProject }
}
