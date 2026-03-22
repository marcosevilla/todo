import { useCallback, useEffect, useState } from 'react'
import { readQuickCaptures } from '@/services/tauri'
import { Button } from '@/components/ui/button'
import { open } from '@tauri-apps/plugin-shell'
import type { QuickCapture } from '@/services/tauri'

export function CapturesPanel() {
  const [captures, setCaptures] = useState<QuickCapture[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const data = await readQuickCaptures()
      setCaptures(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load captures: {error}
      </p>
    )
  }

  if (captures.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recent captures.</p>
    )
  }

  return (
    <div className="space-y-3">
      {captures.map((capture, i) => (
        <div key={i} className="space-y-0.5">
          {capture.timestamp && (
            <p className="text-[10px] text-muted-foreground">
              {capture.timestamp}
            </p>
          )}
          <p className="text-sm leading-snug">{capture.content}</p>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() =>
          open('obsidian://open?vault=marcowits&file=inbox/Quick Captures')
        }
      >
        Open in Obsidian
      </Button>
    </div>
  )
}
