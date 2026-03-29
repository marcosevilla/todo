import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { Sun, CheckSquare, Inbox, BookOpen, Settings, Command } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

const MIN_WIDTH = 48
const MAX_WIDTH = 200
const COLLAPSE_THRESHOLD = 80 // below this = icon-only mode

const NAV_ITEMS: { id: 'today' | 'tasks' | 'inbox' | 'session'; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'session', label: 'Activity', icon: BookOpen },
]

function NavButton({
  label,
  icon: Icon,
  isActive,
  expanded,
  onClick,
}: {
  label: string
  icon: LucideIcon
  isActive: boolean
  expanded: boolean
  onClick: () => void
}) {
  const buttonClasses = cn(
    'flex h-9 items-center rounded-lg transition-all duration-150 cursor-pointer',
    expanded ? 'w-full gap-2.5 px-2.5' : 'w-9 justify-center',
    isActive
      ? 'bg-accent/60 text-foreground'
      : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20',
  )

  const content = (
    <>
      <Icon className="size-[18px] shrink-0" />
      {expanded && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
    </>
  )

  if (expanded) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()} className={buttonClasses}>
        {content}
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger onClick={onClick} className={buttonClasses}>
        {content}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function NavSidebar() {
  const currentPage = useAppStore((s) => s.currentPage)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)

  const [width, setWidth] = useState(MIN_WIDTH)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(MIN_WIDTH)

  const expanded = width >= COLLAPSE_THRESHOLD

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
      const delta = e.clientX - startX.current
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(newWidth)
    }
    function handleMouseUp() {
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Snap to collapsed or expanded
      setWidth((w) => w < COLLAPSE_THRESHOLD ? MIN_WIDTH : w)
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
    <nav
      className="relative flex flex-col border-r border-border/20 bg-muted/10 py-3"
      style={{ width }}
    >
      {/* Nav items */}
      <div className={cn('flex flex-1 flex-col gap-1', expanded ? 'px-2' : 'items-center')}>
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            label={item.label}
            icon={item.icon}
            isActive={currentPage === item.id}
            expanded={expanded}
            onClick={() => setCurrentPage(item.id)}
          />
        ))}
      </div>

      {/* Bottom items */}
      <div className={cn('mt-auto flex flex-col gap-1', expanded ? 'px-2' : 'items-center')}>
        <NavButton
          label="Command"
          icon={Command}
          isActive={false}
          expanded={expanded}
          onClick={() => {
            // Dispatch custom event that CommandBar listens for
            window.dispatchEvent(new Event('open-command-bar'))
          }}
        />
        <NavButton
          label="Settings"
          icon={Settings}
          isActive={currentPage === 'settings'}
          expanded={expanded}
          onClick={() => setCurrentPage('settings')}
        />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute right-0 top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors',
          dragging ? 'bg-accent-blue/40' : 'hover:bg-accent-blue/20',
        )}
      />
    </nav>
  )
}
