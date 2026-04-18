import { useEffect, useRef, useState } from 'react'
import { TYPO_TOKENS } from '@/lib/typography-tokens'
import { cn } from '@/lib/utils'
import { GripHorizontal, X } from 'lucide-react'

/* Draggable dev overlay that renders every design-system type token at
 * actual scale with its token name and numeric values. Mount this behind
 * a DEV gate in App.tsx; keyboard shortcut ⌘⇧J toggles it. Position
 * persists across reloads via localStorage.
 *
 * Each row shows:
 *   text-<name>   <size>·<weight>·<tracking>
 *   <preview-rendered-with-the-actual-token-class>
 *
 * Reads TYPO_TOKENS so the panel is always in sync with the tuner's data
 * source — if the token list changes, this panel picks it up automatically. */

const STORAGE_KEY = 'type-system-overlay:pos'
const INITIAL_POS = { x: 24, y: 80 }

export function TypeSystemOverlay({ onClose }: { onClose: () => void }) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved) as { x: number; y: number }
    } catch {
      /* ignore parse/storage errors, fall back to default */
    }
    return INITIAL_POS
  })
  const [dragging, setDragging] = useState(false)
  const offset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
    } catch {
      /* storage full or disabled — panel still works, just won't persist */
    }
  }, [pos])

  useEffect(() => {
    if (!dragging) return
    function onMove(e: MouseEvent) {
      setPos({
        x: e.clientX - offset.current.x,
        y: e.clientY - offset.current.y,
      })
    }
    function onUp() {
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  function startDrag(e: React.MouseEvent) {
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    }
    setDragging(true)
  }

  return (
    <div
      className={cn(
        'fixed z-[9999] w-[360px] max-h-[min(640px,calc(100vh-48px))]',
        'flex flex-col overflow-hidden select-none',
        'rounded-lg border border-border/40 bg-background/95 backdrop-blur-sm shadow-2xl',
        dragging && 'shadow-[0_30px_60px_-15px_oklch(0_0_0/0.35)]',
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onMouseDown={startDrag}
        className={cn(
          'flex items-center justify-between px-3 py-2 border-b border-border/20',
          'bg-muted/40',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="text-label text-foreground">Type system</span>
          <span className="text-caption text-muted-foreground/70 truncate">
            ⌘⇧J to toggle · drag to move
          </span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-0.5 -m-0.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-accent/30 transition-colors"
          aria-label="Close type system overlay"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto divide-y divide-border/20">
        {TYPO_TOKENS.map((t) => (
          <div key={t.name} className="flex flex-col gap-1.5 px-3 py-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-mono text-caption text-accent-blue">
                text-{t.name}
              </span>
              <span className="font-mono text-caption text-muted-foreground/60 truncate">
                {t.size}px · {t.weight} · {formatTracking(t.tracking)}
              </span>
            </div>
            <span className={cn(`text-${t.name}`, 'block truncate text-foreground')}>
              {t.preview}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTracking(em: number): string {
  if (em === 0) return '0 tr'
  const sign = em > 0 ? '+' : ''
  return `${sign}${em}em`
}
