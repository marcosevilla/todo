import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const isRefreshing = useAppStore((s) => s.isRefreshing)
  const lastRefreshedAt = useAppStore((s) => s.lastRefreshedAt)

  return (
    <div className="flex items-center gap-2">
      {lastRefreshedAt && (
        <span className="text-[11px] text-muted-foreground">
          Updated {format(new Date(lastRefreshedAt), 'h:mm a')}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="h-7 px-2 text-xs"
      >
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  )
}
