import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

const LEVELS = [
  { value: 'high' as const, label: 'High', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  { value: 'medium' as const, label: 'Medium', color: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  { value: 'low' as const, label: 'Low', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
] as const

export function EnergySelector() {
  const energyLevel = useAppStore((s) => s.energyLevel)
  const setEnergyLevel = useAppStore((s) => s.setEnergyLevel)

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Energy</span>
      {LEVELS.map(({ value, label, color }) => (
        <button
          key={value}
          onClick={() => setEnergyLevel(value)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
            energyLevel === value
              ? color
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
