import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { readTodayMd, toggleObsidianCheckbox } from '@/services/tauri'
import type { ParsedTodayMd } from '@/services/tauri'
import { friendlyError } from '@/lib/errors'
import { toast } from 'sonner'

export function useObsidian() {
  const [todayData, setTodayData] = useState<ParsedTodayMd | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const setObsidianToday = useAppStore((s) => s.setObsidianToday)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await readTodayMd()
      setTodayData(data)
      const summary = [
        ...data.tasks.map((t) => `${t.checked ? '[x]' : '[ ]'} ${t.text}`),
        ...data.habits_core.map((h) => `${h.checked ? '[x]' : '[ ]'} ${h.text}`),
      ].join('\n')
      setObsidianToday(summary)
    } catch (e) {
      const msg = friendlyError(e)
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [setObsidianToday])

  const toggleCheckbox = useCallback(
    async (lineNumber: number) => {
      try {
        const updated = await toggleObsidianCheckbox('today.md', lineNumber)
        setTodayData(updated)
      } catch (e) {
        const msg = friendlyError(e)
        setError(msg)
        toast.error(msg)
      }
    },
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { todayData, error, loading, refresh, toggleCheckbox }
}
