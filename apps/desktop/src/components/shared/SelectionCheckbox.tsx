import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selectionStore'

interface SelectionCheckboxProps {
  id: string
  type: 'task' | 'capture'
  allIds?: string[]
  /**
   * When true, the checkbox is rendered but transparent at rest — only
   * showing on group-hover or when the row is selected. Consumers using
   * absolute positioning can pass `false` and manage visibility at the
   * wrapper level instead.
   */
  autoHide?: boolean
}

export function SelectionCheckbox({ id, type, allIds, autoHide = true }: SelectionCheckboxProps) {
  const isSelected = useSelectionStore((s) => s.selectedIds.has(id))
  const hasSelection = useSelectionStore((s) => s.hasSelection)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useSelectionStore.getState()
    if (e.shiftKey && allIds) {
      store.rangeSelect(id, type, allIds)
    } else {
      store.toggle(id, type)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded border transition-all',
        isSelected
          ? 'border-accent-blue bg-accent-blue text-white'
          : 'border-muted-foreground/30 hover:border-muted-foreground/50',
        autoHide &&
          (hasSelection || isSelected
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'),
      )}
    >
      {isSelected && <Check className="size-3" />}
    </button>
  )
}
