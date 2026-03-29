import { CalendarPanel } from '@/components/calendar/CalendarPanel'
import { HabitsPanel } from '@/components/obsidian/HabitsPanel'
import { useCalendar } from '@/hooks/useCalendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Calendar, Heart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: LucideIcon
  label: string
}) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      <Icon size={14} className="text-muted-foreground" />
      {label}
    </h3>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <p className="text-xs text-muted-foreground/60">{message}</p>
    </div>
  )
}

export function RightSidebar() {
  const { events, loading } = useCalendar()
  const hasEvents = loading || events.length > 0

  return (
    <aside className="flex w-72 flex-col border-l border-border/50 bg-muted/20">
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {/* Schedule section */}
          {hasEvents && (
            <div className="p-4">
              <SectionHeader icon={Calendar} label="Schedule" />
              <CalendarPanel />
            </div>
          )}

          {/* Divider */}
          {hasEvents && (
            <div className="px-4">
              <Separator />
            </div>
          )}

          {/* Habits section */}
          <div className="p-4">
            <SectionHeader icon={Heart} label="Habits" />
            <HabitsPanel />
          </div>

          {/* Empty state fallback when no schedule */}
          {!hasEvents && (
            <>
              <div className="px-4">
                <Separator />
              </div>
              <div className="p-4">
                <SectionHeader icon={Calendar} label="Schedule" />
                <EmptyState message="No meetings today — deep work time." />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
