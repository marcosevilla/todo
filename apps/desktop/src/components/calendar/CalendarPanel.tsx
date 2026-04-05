import { useEffect, useRef, useState, useCallback } from 'react'
import { useCalendar } from '@/hooks/useCalendar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { openUrl } from '@/services/tauri'
import type { CalendarEvent } from '@/services/tauri'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ── Helpers ──

const HOUR_HEIGHT = 56
const TIME_LABEL_WIDTH = 28
const MIN_BLOCK_HEIGHT = 24

function formatCompactTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h)) return time
  const hour = h % 12 || 12
  const suffix = h >= 12 ? 'p' : 'a'
  if (m === 0) return `${hour}${suffix}`
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

function formatTimeRange(start: string, end: string): string {
  return `${formatCompactTime(start)} – ${formatCompactTime(end)}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h)) return 0
  return h * 60 + (m || 0)
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function formatDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[d.getDay()]
}

function isDatePast(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T12:00:00')
  d.setHours(0, 0, 0, 0)
  return d < today
}

// ── Sub-Components ──

function DayNavigationHeader({
  selectedDate,
  isToday,
  onPrev,
  onNext,
  onGoToday,
}: {
  selectedDate: string
  isToday: boolean
  onPrev: () => void
  onNext: () => void
  onGoToday: () => void
}) {
  return (
    <div className="flex items-center justify-between px-1 mb-2">
      <button
        onClick={onPrev}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent/30 transition-colors"
        title="Previous day"
      >
        <ChevronLeft className="size-3.5" />
      </button>

      <div className="flex flex-col items-center min-w-0">
        <button
          onClick={onGoToday}
          className={cn(
            'text-[12px] font-medium leading-tight transition-colors',
            isToday ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
          title="Jump to today"
        >
          {isToday ? `Today, ${formatDateHeader(selectedDate)}` : formatDateHeader(selectedDate)}
        </button>
        <span className="text-[10px] text-muted-foreground/60 leading-tight">
          {formatDayOfWeek(selectedDate)}
        </span>
      </div>

      <button
        onClick={onNext}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent/30 transition-colors"
        title="Next day"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}

function AllDayStrip({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null

  const visible = events.slice(0, 2)
  const overflow = events.length - 2

  return (
    <div className="mb-2 space-y-1">
      {visible.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted/30"
          style={{
            borderLeft: `3px solid ${event.feed_color || '#6366f1'}`,
          }}
        >
          <span className="truncate">{event.summary}</span>
        </div>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground/60 pl-2">
          +{overflow} more
        </span>
      )}
    </div>
  )
}

function CurrentTimeIndicator({ startHour }: { startHour: number }) {
  const [offset, setOffset] = useState(() => {
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()
    return ((minutes - startHour * 60) / 60) * HOUR_HEIGHT
  })

  useEffect(() => {
    function update() {
      const now = new Date()
      const minutes = now.getHours() * 60 + now.getMinutes()
      setOffset(((minutes - startHour * 60) / 60) * HOUR_HEIGHT)
    }
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [startHour])

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: offset }}
    >
      <div className="relative flex items-center">
        <div className="size-[7px] rounded-full bg-red-500 -ml-[3px]" />
        <div className="flex-1 h-px bg-red-500/70" />
      </div>
    </div>
  )
}

function EventBlock({
  event,
  startHour,
}: {
  event: CalendarEvent
  startHour: number
}) {
  const [hovered, setHovered] = useState(false)
  const startMin = timeToMinutes(event.start_time)
  const endMin = timeToMinutes(event.end_time)
  const durationMin = Math.max(endMin - startMin, 0)
  const isShort = durationMin < 30

  const topPx = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT
  const rawHeight = (durationMin / 60) * HOUR_HEIGHT
  const height = Math.max(rawHeight, MIN_BLOCK_HEIGHT)

  const feedColor = event.feed_color || '#6366f1'

  return (
    <div
      className="absolute right-0 rounded-md overflow-hidden cursor-default transition-shadow hover:shadow-md"
      style={{
        top: topPx,
        height,
        left: TIME_LABEL_WIDTH + 4,
        borderLeft: `3px solid ${feedColor}`,
        backgroundColor: `${feedColor}15`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col justify-center overflow-hidden">
        <p className="text-[11px] font-semibold leading-tight truncate">
          {event.summary}
        </p>
        {!isShort && (
          <p className="text-[10px] text-muted-foreground leading-tight truncate mt-px">
            {formatTimeRange(event.start_time, event.end_time)}
          </p>
        )}
        {!isShort && event.location && !event.meeting_url && (
          <p className="text-[9px] text-muted-foreground/60 leading-tight truncate">
            {event.location}
          </p>
        )}
      </div>
      {event.meeting_url && hovered && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-0.5 right-0.5 h-5 px-1.5 text-[9px] font-medium opacity-90"
          onClick={(e) => {
            e.stopPropagation()
            openUrl(event.meeting_url!)
          }}
        >
          Join
        </Button>
      )}
    </div>
  )
}

function TimeGrid({
  events,
  isToday,
}: {
  events: CalendarEvent[]
  isToday: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Determine smart window
  const timedEvents = events.filter((e) => !e.all_day)

  if (timedEvents.length === 0) return null

  const allMinutes = timedEvents.flatMap((e) => [
    timeToMinutes(e.start_time),
    timeToMinutes(e.end_time),
  ])
  const earliest = Math.min(...allMinutes)
  const latest = Math.max(...allMinutes)

  const startHour = Math.max(0, Math.floor(earliest / 60) - 1)
  const endHour = Math.min(24, Math.ceil(latest / 60) + 1)
  const totalHours = endHour - startHour

  const gridHeight = totalHours * HOUR_HEIGHT

  // Auto-scroll to show current time indicator if today
  useEffect(() => {
    if (isToday && scrollRef.current) {
      const now = new Date()
      const minutes = now.getHours() * 60 + now.getMinutes()
      const offset = ((minutes - startHour * 60) / 60) * HOUR_HEIGHT
      // Scroll so current time is roughly 1/3 from top
      const scrollTop = Math.max(0, offset - scrollRef.current.clientHeight / 3)
      scrollRef.current.scrollTop = scrollTop
    }
  }, [isToday, startHour])

  // Generate hour labels
  const hourLabels: { hour: number; label: string }[] = []
  for (let h = startHour; h < endHour; h++) {
    const h12 = h % 12 || 12
    const suffix = h >= 12 ? 'p' : 'a'
    hourLabels.push({ hour: h, label: `${h12}${suffix}` })
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto flex-1 min-h-0"
    >
      <div className="relative" style={{ height: gridHeight }}>
        {/* Hour lines and labels */}
        {hourLabels.map(({ hour, label }) => {
          const y = (hour - startHour) * HOUR_HEIGHT
          return (
            <div key={hour} className="absolute left-0 right-0" style={{ top: y }}>
              <div className="flex items-start">
                <span className="text-[10px] tabular-nums text-muted-foreground/40 leading-none -mt-[5px]" style={{ width: TIME_LABEL_WIDTH }}>
                  {label}
                </span>
                <div className="flex-1 border-t border-border/10" />
              </div>
            </div>
          )
        })}

        {/* Current time indicator */}
        {isToday && (
          <div style={{ marginLeft: TIME_LABEL_WIDTH }}>
            <CurrentTimeIndicator startHour={startHour} />
          </div>
        )}

        {/* Event blocks */}
        {timedEvents.map((event) => (
          <EventBlock key={event.id} event={event} startHour={startHour} />
        ))}
      </div>
    </div>
  )
}

function EmptyDayState({ dateStr, isToday }: { dateStr: string; isToday: boolean }) {
  const isPast = isDatePast(dateStr)
  const message = isToday
    ? 'Nothing scheduled — deep work time.'
    : isPast
    ? 'No events'
    : 'Clear day ahead'

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-xs text-muted-foreground/50">{message}</p>
    </div>
  )
}

// ── Main Component ──

export function CalendarPanel() {
  const {
    events,
    error,
    loading,
    selectedDate,
    isToday,
    goToToday,
    goNext,
    goPrev,
    refresh,
  } = useCalendar()

  // Keyboard shortcuts when panel is focused/hovered
  const panelRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!focused) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        goToToday()
      }
    },
    [focused, goPrev, goNext, goToToday],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const allDayEvents = events.filter((e) => e.all_day)
  const timedEvents = events.filter((e) => !e.all_day)

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-10 flex-1 rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="flex flex-col h-full"
      onMouseEnter={() => setFocused(true)}
      onMouseLeave={() => setFocused(false)}
    >
      <DayNavigationHeader
        selectedDate={selectedDate}
        isToday={isToday}
        onPrev={goPrev}
        onNext={goNext}
        onGoToday={goToToday}
      />

      {error && (
        <div className="space-y-2 mb-2">
          <p className="text-[11px] text-destructive">Could not load calendar</p>
          <Button variant="ghost" size="sm" onClick={refresh} className="text-[10px] h-6">
            Retry
          </Button>
        </div>
      )}

      {!error && (
        <>
          <AllDayStrip events={allDayEvents} />

          {timedEvents.length > 0 ? (
            <TimeGrid events={timedEvents} isToday={isToday} />
          ) : (
            allDayEvents.length === 0 && (
              <EmptyDayState dateStr={selectedDate} isToday={isToday} />
            )
          )}
        </>
      )}
    </div>
  )
}
