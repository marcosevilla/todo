import { useCallback, useEffect, useRef, useState } from 'react'
import { getCaptures, createCapture, importObsidianCaptures, convertCaptureToTask } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { useDetailStore } from '@/stores/detailStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { taskToast } from '@/lib/taskToast'
import type { Capture } from '@/services/tauri'
import { Download } from 'lucide-react'

interface CapturesPanelProps {
  autoFocus?: boolean
}

export function CapturesPanel({ autoFocus }: CapturesPanelProps) {
  const [captures, setCaptures] = useState<Capture[]>([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getCaptures(20)
      setCaptures(data)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

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
      const capture = await createCapture(text, 'inbox')
      setCaptures((prev) => [capture, ...prev])
      setInputValue('')
      toast.success('Captured')
    } catch (e) {
      toast.error(`Capture failed: ${e}`)
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }, [inputValue, submitting])

  const handleConvert = useCallback(async (capture: Capture) => {
    try {
      const task = await convertCaptureToTask(capture.id)
      taskToast(`Task created: "${capture.content}"`, task.id)
      emitTasksChanged()
      refresh()
    } catch (e) {
      toast.error(`Failed to convert: ${e}`)
    }
  }, [refresh])

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      const count = await importObsidianCaptures()
      if (count > 0) {
        toast.success(`Imported ${count} captures from Obsidian`)
        refresh()
      } else {
        toast.success('No new captures to import')
      }
    } catch (e) {
      toast.error(`Import failed: ${e}`)
    } finally {
      setImporting(false)
    }
  }, [refresh])

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <div className="space-y-4">
      {/* Capture input */}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder="Capture a thought..."
          disabled={submitting}
          className="flex-1"
        />
        <Button size="sm" onClick={handleSubmit} disabled={!inputValue.trim() || submitting}>
          {submitting ? '...' : 'Capture'}
        </Button>
      </div>

      {/* Captures list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5 w-3/4" />)}
        </div>
      ) : captures.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No captures yet — type something above or use {'\u2318'}K
          </p>
          <Button variant="ghost" size="sm" onClick={handleImport} disabled={importing} className="gap-1.5 text-xs">
            <Download className="size-3" />
            {importing ? 'Importing...' : 'Import from Obsidian'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {captures.map((capture) => (
            <div key={capture.id} className="group/capture flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => useDetailStore.getState().openCapture(capture.id)}
                  className="text-left w-full"
                >
                  <p className="text-sm leading-snug hover:text-foreground transition-colors cursor-pointer">
                    {capture.content}
                  </p>
                </button>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {formatTime(capture.created_at)}
                  {capture.source !== 'manual' && capture.source !== 'inbox' && (
                    <span className="ml-1.5">via {capture.source}</span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-1.5 text-[10px] opacity-0 transition-opacity group-hover/capture:opacity-100"
                onClick={() => handleConvert(capture)}
              >
                Make task
              </Button>
            </div>
          ))}

          {/* Import button */}
          <Button variant="ghost" size="sm" onClick={handleImport} disabled={importing} className="gap-1.5 text-xs mt-2">
            <Download className="size-3" />
            {importing ? 'Importing...' : 'Import from Obsidian'}
          </Button>
        </div>
      )}
    </div>
  )
}
