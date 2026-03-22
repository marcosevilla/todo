import { useCallback, useEffect, useState } from 'react'
import { readTodayMd, toggleObsidianCheckbox } from '@/services/tauri'
import type { ParsedTodayMd } from '@/services/tauri'

export function useObsidian() {
  const [todayData, setTodayData] = useState<ParsedTodayMd | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await readTodayMd()
      setTodayData(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleCheckbox = useCallback(
    async (lineNumber: number) => {
      try {
        const updated = await toggleObsidianCheckbox('today.md', lineNumber)
        setTodayData(updated)
      } catch (e) {
        setError(String(e))
      }
    },
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { todayData, error, loading, refresh, toggleCheckbox }
}
