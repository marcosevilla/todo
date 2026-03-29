import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useFocusStore, type FocusConfig } from '@/stores/focusStore'
import { getSetting } from '@/services/tauri'
import { Play, Timer, TrendingUp, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { LocalTask } from '@/services/tauri'

const COUNTDOWN_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 25, label: '25 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '60 min' },
]

const ROUND_OPTIONS = [1, 2, 3, 4]

interface FocusPlayMenuProps {
  task: LocalTask
  onOpenChange?: (open: boolean) => void
}

export function FocusPlayMenu({ task, onOpenChange }: FocusPlayMenuProps) {
  const [open, setOpenState] = useState(false)
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v)
    onOpenChange?.(v)
  }, [onOpenChange])
  const [hoveredCountdown, setHoveredCountdown] = useState<number | null>(null)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const startFocus = useFocusStore((s) => s.startFocus)

  // Load break length default from settings
  useEffect(() => {
    if (open) {
      getSetting('focus_break_minutes').then((val) => {
        if (val) setBreakMinutes(parseInt(val, 10) || 5)
      }).catch(() => {})
    }
  }, [open])

  const handleStart = useCallback((config: FocusConfig) => {
    startFocus(task, config)
    setOpen(false)
  }, [task, startFocus])

  const handleStopwatch = useCallback(() => {
    handleStart({ timerMode: 'up', targetMinutes: 0, breakMinutes: 0, totalPomodoros: 1 })
  }, [handleStart])

  const handleCountdown = useCallback((minutes: number, rounds: number) => {
    handleStart({ timerMode: 'down', targetMinutes: minutes, breakMinutes, totalPomodoros: rounds })
  }, [handleStart, breakMinutes])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-md transition-colors',
          'text-accent-blue/60 hover:text-accent-blue hover:bg-accent/20',
        )}
      >
        <Play className="size-3" />
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="w-44 gap-0 p-1"
      >
        {/* Countdown options */}
        {COUNTDOWN_OPTIONS.map((opt) => (
          <div
            key={opt.minutes}
            className="relative"
            onMouseEnter={() => setHoveredCountdown(opt.minutes)}
            onMouseLeave={() => setHoveredCountdown(null)}
          >
            <button
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                hoveredCountdown === opt.minutes ? 'bg-accent/40' : 'hover:bg-accent/20',
              )}
              onClick={() => handleCountdown(opt.minutes, 1)}
            >
              <Timer className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-left">{opt.label}</span>
              <ChevronRight className="size-3 text-muted-foreground/40" />
            </button>

            {/* Rounds sub-popover */}
            {hoveredCountdown === opt.minutes && (
              <div className="absolute left-full top-0 z-50 ml-1 animate-in fade-in slide-in-from-left-1 duration-100">
                <div className="w-32 rounded-lg border border-border/50 bg-popover p-1 shadow-lg ring-1 ring-foreground/10">
                  <button
                    className="flex w-full items-center rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/20 transition-colors"
                    onClick={() => handleCountdown(opt.minutes, 1)}
                  >
                    No breaks
                  </button>
                  {ROUND_OPTIONS.filter((r) => r > 1).map((rounds) => (
                    <button
                      key={rounds}
                      className="flex w-full items-center rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/20 transition-colors"
                      onClick={() => handleCountdown(opt.minutes, rounds)}
                    >
                      {rounds} rounds
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Separator */}
        <div className="mx-1.5 my-1 border-t border-border/30" />

        {/* Stopwatch option */}
        <button
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/20 transition-colors"
          onClick={handleStopwatch}
        >
          <TrendingUp className="size-3.5 text-muted-foreground" />
          <span>Stopwatch</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
