import { useCallback, useEffect, useRef, useState } from 'react'
import { readQuickCaptures, writeQuickCapture } from '@/services/tauri'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { openUrl } from '@/services/tauri'
import { toast } from 'sonner'
import type { QuickCapture } from '@/services/tauri'

interface CapturesPanelProps {
  autoFocus?: boolean
  onConvertToTask?: (content: string) => void
}

export function CapturesPanel({ autoFocus, onConvertToTask }: CapturesPanelProps) {
  const [captures, setCaptures] = useState<QuickCapture[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Auto-focus when requested (e.g. from tray capture)
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [autoFocus])

  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || submitting) return

    setSubmitting(true)
    try {
      const capture = await writeQuickCapture(text)
      // Prepend to list immediately
      setCaptures((prev) => [capture, ...prev].slice(0, 10))
      setInputValue('')
      toast.success('Captured')
    } catch (e) {
      toast.error(`Capture failed: ${e}`)
    } finally {
      setSubmitting(false)
      // Refocus input for rapid capture
      inputRef.current?.focus()
    }
  }, [inputValue, submitting])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <div className="space-y-4">
      {/* Capture input */}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Capture a thought..."
          disabled={submitting}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!inputValue.trim() || submitting}
        >
          {submitting ? '...' : 'Capture'}
        </Button>
      </div>

      {/* Captures list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-3/4" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">Could not load captures</p>
          <Button variant="ghost" size="sm" onClick={refresh} className="text-xs">
            Retry
          </Button>
        </div>
      ) : captures.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No captures yet — type something above or use {'\u2318'}K
        </p>
      ) : (
        <div className="space-y-3">
          {captures.map((capture, i) => (
            <div key={i} className="group/capture flex items-start gap-2">
              <div className="flex-1 space-y-0.5">
                {capture.timestamp && (
                  <p className="text-[10px] text-muted-foreground">
                    {capture.timestamp}
                  </p>
                )}
                <p className="text-sm leading-snug">{capture.content}</p>
              </div>
              {onConvertToTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-1.5 text-[10px] opacity-0 transition-opacity group-hover/capture:opacity-100"
                  onClick={() => onConvertToTask(capture.content)}
                >
                  Make task
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              openUrl('obsidian://open?vault=marcowits&file=inbox/Quick Captures')
            }
          >
            Open in Obsidian
          </Button>
        </div>
      )}
    </div>
  )
}
