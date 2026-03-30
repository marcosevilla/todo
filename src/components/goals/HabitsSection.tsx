import { useEffect, useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useGoalsStore } from '@/stores/goalsStore'
import { logHabit, unlogHabit, getHabitHeatmap } from '@/services/tauri'
import type { HabitHeatmapEntry } from '@/services/tauri'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame } from 'lucide-react'

// ── Habit Circle ──

function HabitCircle({
  name,
  icon,
  color,
  completed,
  momentum,
  onToggle,
}: {
  name: string
  icon: string
  color: string
  completed: boolean
  momentum: number
  onToggle: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'relative size-10 rounded-full flex items-center justify-center text-lg transition-all duration-200 cursor-pointer',
            completed
              ? 'ring-2 scale-105'
              : 'ring-1 ring-border/30 hover:ring-border/60 opacity-50 hover:opacity-80',
          )}
          style={{
            backgroundColor: completed ? `${color}20` : 'transparent',
            outlineColor: completed ? color : undefined,
          }}
          onClick={onToggle}
          aria-label={`${completed ? 'Unmark' : 'Mark'} ${name} as done`}
        >
          <span className="select-none">{icon}</span>
          {completed && (
            <span
              className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              ✓
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs">
            <div className="font-medium">{name}</div>
            <div className="opacity-70">{completed ? 'Done today' : 'Not done yet'}</div>
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Momentum bar */}
      <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(momentum, 100)}%`,
            backgroundColor: color,
            opacity: momentum > 0 ? 0.7 : 0,
          }}
        />
      </div>
    </div>
  )
}

// ── Heatmap ──

const CELL_SIZE = 12
const CELL_GAP = 2
const WEEKS = 52
const DAYS = 7
const AMBER_LEVELS = [
  'transparent',
  'oklch(0.85 0.12 85 / 0.25)',   // intensity 1
  'oklch(0.78 0.14 80 / 0.45)',   // intensity 2
  'oklch(0.72 0.16 75 / 0.65)',   // intensity 3
  'oklch(0.65 0.17 70 / 0.85)',   // intensity 4+
]

function getHeatmapColor(intensity: number): string {
  if (intensity <= 0) return AMBER_LEVELS[0]
  if (intensity >= 4) return AMBER_LEVELS[4]
  return AMBER_LEVELS[intensity]
}

function HabitHeatmap({ data }: { data: HabitHeatmapEntry[] }) {
  const grid = useMemo(() => {
    // Build a map from date string to intensity
    const intensityMap: Record<string, number> = {}
    for (const entry of data) {
      intensityMap[entry.date] = (intensityMap[entry.date] || 0) + entry.intensity
    }

    // Build grid: 52 weeks x 7 days, ending today
    const today = new Date()
    const cells: { date: string; intensity: number; col: number; row: number }[] = []

    for (let w = WEEKS - 1; w >= 0; w--) {
      for (let d = 0; d < DAYS; d++) {
        const daysAgo = w * 7 + (6 - d) // Sunday = 0
        const cellDate = new Date(today)
        cellDate.setDate(today.getDate() - daysAgo + (today.getDay() - 6))
        const dateStr = cellDate.toISOString().slice(0, 10)
        cells.push({
          date: dateStr,
          intensity: intensityMap[dateStr] || 0,
          col: WEEKS - 1 - w,
          row: d,
        })
      }
    }

    return cells
  }, [data])

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = []
    let lastMonth = -1
    for (const cell of grid) {
      if (cell.row !== 0) continue
      const month = new Date(cell.date).getMonth()
      if (month !== lastMonth) {
        lastMonth = month
        labels.push({
          label: new Date(cell.date).toLocaleString('default', { month: 'short' }),
          col: cell.col,
        })
      }
    }
    return labels
  }, [grid])

  const gridWidth = WEEKS * (CELL_SIZE + CELL_GAP)
  const gridHeight = DAYS * (CELL_SIZE + CELL_GAP)

  return (
    <div className="overflow-x-auto">
      <div style={{ width: gridWidth, minWidth: gridWidth }}>
        {/* Month labels */}
        <div className="flex mb-1" style={{ height: 14 }}>
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="text-[9px] text-muted-foreground absolute"
              style={{ left: m.col * (CELL_SIZE + CELL_GAP) }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
          {grid.map((cell, i) => (
            <Tooltip key={i}>
              <TooltipTrigger
                className="absolute rounded-sm transition-colors"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  left: cell.col * (CELL_SIZE + CELL_GAP),
                  top: cell.row * (CELL_SIZE + CELL_GAP),
                  backgroundColor: getHeatmapColor(cell.intensity),
                  border: cell.intensity === 0 ? '1px solid oklch(from var(--border) l c h / 0.15)' : 'none',
                }}
              />
              <TooltipContent side="top">
                <div className="text-[10px]">
                  <div>{cell.date}</div>
                  {cell.intensity > 0 && <div className="opacity-70">{cell.intensity} activities</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Habits Section ──

export function HabitsSection() {
  const habits = useGoalsStore((s) => s.habits)
  const habitsLoading = useGoalsStore((s) => s.habitsLoading)
  const loadHabits = useGoalsStore((s) => s.loadHabits)

  const [heatmapData, setHeatmapData] = useState<HabitHeatmapEntry[]>([])
  const [heatmapLoading, setHeatmapLoading] = useState(true)

  useEffect(() => {
    loadHabits()
    getHabitHeatmap(undefined, 365)
      .then(setHeatmapData)
      .catch(() => {})
      .finally(() => setHeatmapLoading(false))
  }, [loadHabits])

  const handleToggle = useCallback(async (habitId: string, currentlyCompleted: boolean) => {
    try {
      if (currentlyCompleted) {
        await unlogHabit(habitId)
      } else {
        await logHabit(habitId)
      }
      await loadHabits()
      // Refresh heatmap
      getHabitHeatmap(undefined, 365).then(setHeatmapData).catch(() => {})
    } catch { /* silently fail */ }
  }, [loadHabits])

  const activeHabits = habits.filter((h) => h.active)
  const completedCount = activeHabits.filter((h) => h.today_completed).length
  const avgMomentum = activeHabits.length > 0
    ? Math.round(activeHabits.reduce((sum, h) => sum + h.current_momentum, 0) / activeHabits.length)
    : 0

  if (habitsLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="size-10 rounded-full" />
          ))}
        </div>
      </div>
    )
  }

  if (activeHabits.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Flame className="size-3.5 text-amber-500" />
          <h3 className="font-heading text-sm font-semibold">Habits</h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {completedCount}/{activeHabits.length}
          </span>
        </div>
        {avgMomentum > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {avgMomentum}% momentum
          </span>
        )}
      </div>

      {/* Habit circles */}
      <div className="flex items-center gap-4 flex-wrap">
        {activeHabits.map((habit) => (
          <HabitCircle
            key={habit.id}
            name={habit.name}
            icon={habit.icon}
            color={habit.color}
            completed={habit.today_completed}
            momentum={habit.current_momentum}
            onToggle={() => handleToggle(habit.id, habit.today_completed)}
          />
        ))}
      </div>

      {/* Heatmap (collapsible) */}
      <CollapsibleSection title="Activity" defaultOpen={false}>
        {heatmapLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <HabitHeatmap data={heatmapData} />
        )}
      </CollapsibleSection>
    </div>
  )
}
