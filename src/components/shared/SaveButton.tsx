import { useEffect } from 'react'
import { useSave } from '@/hooks/useSave'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Save } from 'lucide-react'
import { format } from 'date-fns'

export function SaveButton() {
  const { save, saving, lastSaved, error } = useSave()

  // Cmd+S shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [save])

  const tooltipText = error
    ? `Save failed: ${error}`
    : lastSaved
      ? `Saved ${format(new Date(lastSaved), 'h:mm a')}`
      : 'Save progress'

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={save}
            disabled={saving}
          />
        }
      >
        <Save className={error ? 'text-destructive' : ''} />
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}
