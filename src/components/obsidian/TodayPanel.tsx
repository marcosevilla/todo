import { useObsidian } from '@/hooks/useObsidian'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import type { CheckboxItem } from '@/services/tauri'

function CheckboxRow({
  item,
  onToggle,
}: {
  item: CheckboxItem
  onToggle: (lineNumber: number) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1 group">
      <Checkbox
        checked={item.checked}
        onCheckedChange={() => onToggle(item.line_number)}
        className="mt-0.5"
      />
      <span
        className={`text-sm leading-snug transition-colors ${
          item.checked
            ? 'text-muted-foreground line-through'
            : 'text-foreground group-hover:text-foreground'
        }`}
      >
        {item.text}
      </span>
    </label>
  )
}

export function TodayPanel() {
  const { todayData, error, loading, toggleCheckbox } = useObsidian()

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not read today.md: {error}
      </p>
    )
  }

  if (!todayData) {
    return <p className="text-sm text-muted-foreground">No data</p>
  }

  const { tasks, habits_core, habits_bonus } = todayData
  const coreChecked = habits_core.filter((h) => h.checked).length
  const bonusChecked = habits_bonus.filter((h) => h.checked).length

  return (
    <div className="space-y-4">
      {/* Tasks section */}
      {tasks.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tasks
          </h3>
          <div className="space-y-0.5">
            {tasks.map((item) => (
              <CheckboxRow
                key={item.line_number}
                item={item}
                onToggle={toggleCheckbox}
              />
            ))}
          </div>
        </div>
      )}

      {/* Core habits */}
      {habits_core.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Core Habits
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {coreChecked}/{habits_core.length}
              </span>
            </h3>
            <div className="space-y-0.5">
              {habits_core.map((item) => (
                <CheckboxRow
                  key={item.line_number}
                  item={item}
                  onToggle={toggleCheckbox}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bonus habits */}
      {habits_bonus.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bonus Habits
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {bonusChecked}/{habits_bonus.length}
              </span>
            </h3>
            <div className="space-y-0.5">
              {habits_bonus.map((item) => (
                <CheckboxRow
                  key={item.line_number}
                  item={item}
                  onToggle={toggleCheckbox}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
