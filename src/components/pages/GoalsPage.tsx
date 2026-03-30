import { useEffect, useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useGoalsStore } from '@/stores/goalsStore'
import {
  createGoal,
  importGoalsFromVault,
} from '@/services/tauri'
import type { GoalWithProgress, GoalStatus, LifeArea } from '@/services/tauri'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  LayoutGrid,
  GanttChart,
  Plus,
  Download,
  Target,
  Calendar,
} from 'lucide-react'
import { GoalTimeline } from '@/components/goals/GoalTimeline'

// ── Status Config ──

const GOAL_STATUSES: { value: GoalStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not started', color: 'text-muted-foreground' },
  { value: 'active', label: 'Active', color: 'text-amber-500' },
  { value: 'paused', label: 'Paused', color: 'text-blue-400' },
  { value: 'achieved', label: 'Achieved', color: 'text-green-500' },
  { value: 'abandoned', label: 'Abandoned', color: 'text-muted-foreground/50' },
]

function statusLabel(status: GoalStatus): string {
  return GOAL_STATUSES.find((s) => s.value === status)?.label ?? status
}

function statusColor(status: GoalStatus): string {
  return GOAL_STATUSES.find((s) => s.value === status)?.color ?? 'text-muted-foreground'
}

// ── Goal Card ──

function GoalCard({
  goal,
  area,
  onClick,
}: {
  goal: GoalWithProgress
  area: LifeArea | null
  onClick: () => void
}) {
  const barColor = goal.color || area?.color || '#f59e0b'
  const progressLabel = goal.progress > 0 ? `${goal.progress}%` : 'Not started'

  return (
    <Card
      size="sm"
      className={cn(
        'cursor-pointer transition-all duration-150 hover:ring-foreground/20 hover:shadow-sm',
        goal.status === 'achieved' && 'opacity-75',
      )}
      onClick={onClick}
    >
      <CardContent className="space-y-2.5">
        {/* Top row: life area chip + status */}
        <div className="flex items-center justify-between">
          {area ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${area.color}15`,
                color: area.color,
              }}
            >
              <span className="text-xs">{area.icon}</span>
              {area.name}
            </span>
          ) : (
            <span />
          )}
          <Badge variant="secondary" className={cn('text-[10px]', statusColor(goal.status))}>
            {statusLabel(goal.status)}
          </Badge>
        </div>

        {/* Goal name */}
        <h3 className="text-sm font-semibold leading-snug tracking-tight truncate">
          {goal.name}
        </h3>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                goal.progress >= 100 && 'animate-pulse',
              )}
              style={{
                width: `${Math.min(goal.progress, 100)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
            {progressLabel}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {goal.milestone_count > 0 && (
            <span className="tabular-nums">
              {goal.milestone_completed}/{goal.milestone_count} milestones
            </span>
          )}
          {goal.task_count > 0 && (
            <span className="tabular-nums">
              {goal.task_count} task{goal.task_count !== 1 ? 's' : ''}
            </span>
          )}
          {goal.target_date && (
            <span className="ml-auto flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Goal Create Dialog ──

const GOAL_COLORS = [
  '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316',
]

function GoalCreateDialog({
  open,
  onClose,
  lifeAreas,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  lifeAreas: LifeArea[]
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<GoalStatus>('not_started')
  const [lifeAreaId, setLifeAreaId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [color, setColor] = useState(GOAL_COLORS[0])
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createGoal({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        lifeAreaId: lifeAreaId || undefined,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
        color,
      })
      onCreated()
      handleReset()
      onClose()
    } catch (e) {
      toast.error(`Failed to create goal: ${e}`)
    }
    setSaving(false)
  }

  const handleReset = () => {
    setName('')
    setDescription('')
    setStatus('not_started')
    setLifeAreaId('')
    setStartDate('')
    setTargetDate('')
    setColor(GOAL_COLORS[0])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Goal</DialogTitle>
          <DialogDescription>Define what you want to achieve.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-name" className="text-xs">Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Launch portfolio site"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc" className="text-xs">Description</Label>
            <Input
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
            />
          </div>

          {/* Life Area */}
          {lifeAreas.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Life Area</Label>
              <Select
                value={lifeAreaId}
                onValueChange={(v) => setLifeAreaId(v ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose area..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {lifeAreas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span>{a.icon}</span>
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-start" className="text-xs">Start date</Label>
              <Input
                id="goal-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-target" className="text-xs">Target date</Label>
              <Input
                id="goal-target"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-1.5">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    'size-6 rounded-full border-2 transition-all',
                    color === c
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:border-muted-foreground/50',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? 'Creating...' : 'Create Goal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Goals Page ──

type ViewMode = 'cards' | 'timeline'

export function GoalsPage() {
  const goals = useGoalsStore((s) => s.goals)
  const lifeAreas = useGoalsStore((s) => s.lifeAreas)
  const goalsLoading = useGoalsStore((s) => s.goalsLoading)
  const refresh = useGoalsStore((s) => s.refresh)

  const [view, setView] = useState<ViewMode>('cards')
  const [areaFilter, setAreaFilter] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    refresh()
  }, [refresh])

  const areaMap = useMemo(() => {
    const map: Record<string, LifeArea> = {}
    for (const a of lifeAreas) map[a.id] = a
    return map
  }, [lifeAreas])

  const filteredGoals = useMemo(() => {
    let result = [...goals]
    if (areaFilter) {
      result = result.filter((g) => g.life_area_id === areaFilter)
    }
    // Sort: active first, then by most recently updated
    result.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        active: 0,
        not_started: 1,
        paused: 2,
        achieved: 3,
        abandoned: 4,
      }
      const aDiff = statusOrder[a.status] ?? 5
      const bDiff = statusOrder[b.status] ?? 5
      if (aDiff !== bDiff) return aDiff - bDiff
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return result
  }, [goals, areaFilter])

  // Area counts for filter pills
  const areaCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const g of goals) {
      if (g.life_area_id) {
        counts[g.life_area_id] = (counts[g.life_area_id] || 0) + 1
      }
    }
    return counts
  }, [goals])

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      const result = await importGoalsFromVault()
      toast.success(`Imported ${result.goals_created} goals and ${result.habits_created} habits`)
      await refresh()
    } catch (e) {
      toast.error(`Import failed: ${e}`)
    }
    setImporting(false)
  }, [refresh])

  const handleGoalClick = useCallback((_goalId: string) => {
    // TODO: Open goal detail view
    // Could use detailStore or a goal-specific detail panel
  }, [])

  if (goalsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">Goals</h2>
            <span className="text-xs text-muted-foreground">
              {filteredGoals.length} goal{filteredGoals.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* View toggle */}
          <ToggleGroup
            value={[view]}
            onValueChange={(val) => {
              const v = val[0] as ViewMode | undefined
              if (v) setView(v)
            }}
            size="sm"
          >
            <ToggleGroupItem value="cards" aria-label="Card view">
              <LayoutGrid className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" aria-label="Timeline view">
              <GanttChart className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground',
                importing && 'opacity-50 pointer-events-none',
              )}
              onClick={handleImport}
            >
              <Download className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Import from Obsidian vault</TooltipContent>
          </Tooltip>

          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New Goal
          </Button>
        </div>
      </div>

      {/* Life area filter pills */}
      {lifeAreas.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setAreaFilter(null)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              areaFilter === null
                ? 'bg-foreground text-background'
                : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20',
            )}
          >
            All
            <span className="ml-1 text-[10px] opacity-60">{goals.length}</span>
          </button>
          {lifeAreas.map((area) => {
            const count = areaCounts[area.id] || 0
            if (count === 0 && areaFilter !== area.id) return null
            return (
              <button
                key={area.id}
                onClick={() => setAreaFilter(areaFilter === area.id ? null : area.id)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  areaFilter === area.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20',
                )}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: area.color }}
                />
                {area.name}
                <span className="text-[10px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {filteredGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Target className="size-10 text-muted-foreground/30" />
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              No goals yet. Import from Obsidian or create your first goal.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Goals help you track long-term progress across life areas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleImport} disabled={importing}>
              <Download className="size-3.5" />
              {importing ? 'Importing...' : 'Import from Vault'}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Create Goal
            </Button>
          </div>
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {filteredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              area={goal.life_area_id ? areaMap[goal.life_area_id] : null}
              onClick={() => handleGoalClick(goal.id)}
            />
          ))}
        </div>
      ) : (
        <GoalTimeline
          goals={filteredGoals}
          lifeAreas={lifeAreas}
          onGoalClick={handleGoalClick}
        />
      )}

      {/* Create dialog */}
      <GoalCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        lifeAreas={lifeAreas}
        onCreated={refresh}
      />
    </div>
  )
}
