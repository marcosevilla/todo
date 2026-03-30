import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { fetchCalendarEvents } from '@/services/tauri'
import type { CalendarEvent } from '@/services/tauri'
import { friendlyError } from '@/lib/errors'
import { toast } from 'sonner'

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const setCalendarEvents = useAppStore((s) => s.setCalendarEvents)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchCalendarEvents()
      setEvents(data)
      setCalendarEvents(data.map((e) => ({
        id: e.id,
        summary: e.summary,
        description: e.description,
        location: e.location,
        start_time: e.start_time,
        end_time: e.end_time,
        all_day: e.all_day,
        meeting_url: e.meeting_url,
        feed_label: e.feed_label,
        feed_color: e.feed_color,
      })))
    } catch (e) {
      const msg = friendlyError(e)
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [setCalendarEvents])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { events, error, loading, refresh }
}
