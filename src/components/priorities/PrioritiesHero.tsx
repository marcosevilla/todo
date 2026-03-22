import { usePriorities } from '@/hooks/usePriorities'
import { Button } from '@/components/ui/button'

export function PrioritiesHero() {
  const { priorities, loading, error, refresh } = usePriorities()

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border bg-muted/50"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    )
  }

  if (priorities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="mb-2 text-sm text-muted-foreground">
          Generate your top 3 priorities for today.
        </p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Generate
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {priorities.map((p, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
          >
            <div className="mb-1 flex items-start justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                #{i + 1}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {p.source}
              </span>
            </div>
            <p className="text-sm font-medium leading-snug">{p.title}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {p.reasoning}
            </p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={refresh}
        >
          Re-prioritize
        </Button>
      </div>
    </div>
  )
}
