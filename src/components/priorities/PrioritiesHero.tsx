import { useAppStore } from '@/stores/appStore'

export function PrioritiesHero() {
  const priorities = useAppStore((s) => s.priorities)

  if (priorities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Your top priorities will appear here once data loads.
        </p>
      </div>
    )
  }

  return (
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
  )
}
