import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const isRefreshing = useAppStore((s) => s.isRefreshing)
  const lastRefreshedAt = useAppStore((s) => s.lastRefreshedAt)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          />
        }
      >
        <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
      </TooltipTrigger>
      <TooltipContent>
        {lastRefreshedAt
          ? `Last updated ${format(new Date(lastRefreshedAt), 'h:mm a')}`
          : 'Refresh all'}
      </TooltipContent>
    </Tooltip>
  )
}
