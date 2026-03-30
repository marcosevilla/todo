import { useState, useCallback, useRef, useEffect } from 'react'
import { CalendarPanel } from '@/components/calendar/CalendarPanel'
import { HabitsPanel } from '@/components/obsidian/HabitsPanel'
import { useCalendar } from '@/hooks/useCalendar'
import { Separator } from '@/components/ui/separator'
import { Calendar, Heart, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const MIN_WIDTH = 200
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 288 // w-72

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

  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_WIDTH)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    startX.current = e.clientX
    startWidth.current = width
  }, [width])

  useEffect(() => {
    if (!dragging) return
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    function handleMouseMove(e: MouseEvent) {
      const delta = startX.current - e.clientX // dragging left = wider
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(newWidth)
    }
    function handleMouseUp() {
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging])

  return (
    <aside
      className="relative flex flex-col border-l border-border/20 bg-muted/10 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ width: collapsed ? 36 : width }}
    >
      {/* Collapsed state — expand button */}
      {collapsed && (
        <div className="flex flex-col items-center py-3">
          <button
            onClick={() => setCollapsed(false)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Expand sidebar"
          >
            <PanelRightOpen className="size-4" />
          </button>
        </div>
      )}

      {/* Expanded state */}
      {!collapsed && (
        <>
          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'absolute left-0 top-0 bottom-0 z-10 w-px cursor-col-resize transition-colors bg-border/30',
              dragging ? 'bg-accent-blue/50 w-1' : 'hover:bg-accent-blue/30 hover:w-1',
            )}
          />

          {/* Collapse button */}
          <div className="flex justify-end px-2 pt-2">
            <button
              onClick={() => setCollapsed(true)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
              title="Collapse sidebar"
            >
              <PanelRightClose className="size-3.5" />
            </button>
          </div>
        </>
      )}

      {!collapsed && <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {/* Schedule section */}
          {hasEvents && (
            <div className="p-4 pt-2">
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
      </div>}
    </aside>
  )
}
