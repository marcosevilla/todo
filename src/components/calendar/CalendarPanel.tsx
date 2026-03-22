import { useCalendar } from '@/hooks/useCalendar'
import { Button } from '@/components/ui/button'
import { open } from '@tauri-apps/plugin-shell'
import type { CalendarEventRow } from '@/services/tauri'

function formatTime(time: string): string {
  // Convert HH:MM to 12-hour format
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h)) return time
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function isCurrentEvent(event: CalendarEventRow): boolean {
  if (event.all_day) return false
  const now = new Date()
  const [sh, sm] = event.start_time.split(':').map(Number)
  const [eh, em] = event.end_time.split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return currentMinutes >= sh * 60 + sm && currentMinutes < eh * 60 + em
}

function isPastEvent(event: CalendarEventRow): boolean {
  if (event.all_day) return false
  const now = new Date()
  const [eh, em] = event.end_time.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() > eh * 60 + em
}

function EventRow({ event }: { event: CalendarEventRow }) {
  const current = isCurrentEvent(event)
  const past = isPastEvent(event)

  return (
    <div
      className={`flex items-start gap-3 rounded-md px-2 py-2 transition-colors ${
        current
          ? 'bg-primary/5 border border-primary/20'
          : past
            ? 'opacity-50'
            : ''
      }`}
    >
      <div className="w-16 shrink-0 text-right">
        {event.all_day ? (
          <span className="text-xs font-medium text-muted-foreground">
            All Day
          </span>
        ) : (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatTime(event.start_time)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{event.summary}</p>
        {event.location && (
          <p className="text-xs text-muted-foreground truncate">
            {event.location}
          </p>
        )}
      </div>
      {event.meeting_url && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-[10px]"
          onClick={() => open(event.meeting_url!)}
        >
          Join
        </Button>
      )}
    </div>
  )
}

export function CalendarPanel() {
  const { events, error, loading } = useCalendar()

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load calendar: {error}
      </p>
    )
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No events today. Open day.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  )
}
