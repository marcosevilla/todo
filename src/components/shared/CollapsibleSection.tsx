import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'

interface CollapsibleSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  variant?: 'primary' | 'nested'
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  variant = 'primary',
  icon,
  action,
  className,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={className}>
      <div className="group/section flex items-center">
        <CollapsibleTrigger
          className={cn(
            'flex flex-1 items-center gap-1.5 text-left rounded-md px-2 transition-colors hover:bg-accent/20',
            '[&>svg:first-child]:data-[panel-open]:rotate-90',
            variant === 'primary' ? 'py-2' : 'py-1.5',
          )}
        >
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150" />
          {icon}
          <span className={cn(
            variant === 'primary'
              ? 'text-[11px] font-medium uppercase tracking-wider text-muted-foreground'
              : 'text-sm font-medium text-foreground',
          )}>
            {title}
          </span>
          {count !== undefined && (
            <span className="text-[10px] text-muted-foreground">{count}</span>
          )}
        </CollapsibleTrigger>
        {action && (
          <div className="opacity-0 transition-opacity group-hover/section:opacity-100">
            {action}
          </div>
        )}
      </div>
      <CollapsibleContent className="overflow-hidden transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
        <div className={variant === 'primary' ? 'pl-2' : 'ml-4 border-l pl-3'}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
