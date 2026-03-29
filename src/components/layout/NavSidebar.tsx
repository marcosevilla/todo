import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { Sun, CheckSquare, Inbox, BookOpen, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

const NAV_ITEMS: { id: 'today' | 'tasks' | 'inbox' | 'session'; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'session', label: 'Session', icon: BookOpen },
]

function NavButton({
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string
  icon: LucideIcon
  isActive: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        className={cn(
          'flex w-10 h-10 items-center justify-center rounded-lg transition-all duration-150',
          isActive
            ? 'bg-accent/60 text-foreground'
            : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20',
        )}
      >
        <Icon className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function NavSidebar() {
  const currentPage = useAppStore((s) => s.currentPage)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)

  return (
    <nav className="flex w-12 flex-col items-center border-r border-border/50 bg-muted/20 py-3">
      {/* Nav items */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            label={item.label}
            icon={item.icon}
            isActive={currentPage === item.id}
            onClick={() => setCurrentPage(item.id)}
          />
        ))}
      </div>

      {/* Bottom items */}
      <div className="mt-auto flex flex-col items-center gap-1">
        <NavButton
          label="Settings"
          icon={Settings}
          isActive={currentPage === 'settings'}
          onClick={() => setCurrentPage('settings')}
        />

        {/* Cmd+K hint */}
        <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground/25">
          <kbd className="text-[9px] font-mono">{'\u2318'}K</kbd>
        </div>
      </div>
    </nav>
  )
}
