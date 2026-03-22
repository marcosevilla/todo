import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  icon?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Panel({ title, icon, action, children, className }: PanelProps) {
  return (
    <Card className={`flex flex-col overflow-hidden ${className ?? ''}`}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">
          {icon && <span className="mr-1.5">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </Card>
  )
}
