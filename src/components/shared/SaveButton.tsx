import { useEffect } from 'react'
import { useSave } from '@/hooks/useSave'
import { Button } from '@/components/ui/button'
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

  return (
    <div className="flex items-center gap-2">
      {lastSaved && (
        <span className="text-[11px] text-muted-foreground">
          Saved {format(new Date(lastSaved), 'h:mm a')}
        </span>
      )}
      {error && (
        <span className="text-[11px] text-destructive" title={error}>
          Save failed
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={save}
        disabled={saving}
        className="h-7 px-2.5 text-xs"
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
