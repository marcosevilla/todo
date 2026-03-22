import { useCallback, useEffect, useState } from 'react'
import { fetchCalendarEvents } from '@/services/tauri'
import type { CalendarEventRow } from '@/services/tauri'

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEventRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchCalendarEvents()
      setEvents(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { events, error, loading, refresh }
}
