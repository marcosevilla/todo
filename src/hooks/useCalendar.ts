import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { fetchCalendarEvents } from '@/services/tauri'
import type { CalendarEventRow } from '@/services/tauri'

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEventRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const setCalendarEvents = useAppStore((s) => s.setCalendarEvents)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchCalendarEvents()
      setEvents(data)
      // Store in Zustand for priorities hook
      setCalendarEvents(data.map((e) => ({
        id: e.id,
        summary: e.summary,
        description: e.description,
        location: e.location,
        start_time: e.start_time,
        end_time: e.end_time,
        all_day: e.all_day,
        meeting_url: e.meeting_url,
      })))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [setCalendarEvents])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { events, error, loading, refresh }
}
