import { useCallback, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { saveProgress } from '@/services/tauri'

export function useSave() {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const todoistTasks = useAppStore((s) => s.todoistTasks)

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const completed = todoistTasks
        .filter((t) => t.is_completed)
        .map((t) => t.content)
      const open = todoistTasks
        .filter((t) => !t.is_completed)
        .map((t) => t.content)

      const result = await saveProgress(
        JSON.stringify(completed),
        JSON.stringify(open),
        JSON.stringify([]),
      )

      setLastSaved(new Date().toISOString())
      return result
    } catch (e) {
      setError(String(e))
      return null
    } finally {
      setSaving(false)
    }
  }, [todoistTasks])

  return { save, saving, lastSaved, error }
}
