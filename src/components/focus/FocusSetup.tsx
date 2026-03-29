import { useState, useCallback, useEffect } from 'react'
import { useFocusStore, type FocusConfig, type TimerMode } from '@/stores/focusStore'
import { cn } from '@/lib/utils'
import { Play, Timer, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DURATIONS = [15, 25, 30, 45, 60] as const
const BREAK_DURATIONS = [5, 10, 15] as const
const POMODORO_COUNTS = [1, 2, 3, 4] as const

export function FocusSetup() {
  const task = useFocusStore((s) => s.task)
  const startFocus = useFocusStore((s) => s.startFocus)
  const reset = useFocusStore((s) => s.reset)

  const [timerMode, setTimerMode] = useState<TimerMode>('down')
  const [targetMinutes, setTargetMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [totalPomodoros, setTotalPomodoros] = useState(1)

  const handleStart = useCallback(() => {
    if (!task) return
    const config: FocusConfig = { timerMode, targetMinutes, breakMinutes, totalPomodoros }
    startFocus(task, config)
  }, [task, timerMode, targetMinutes, breakMinutes, totalPomodoros, startFocus])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleStart()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        reset()
      }
      // Number keys for duration (when in countdown mode)
      if (timerMode === 'down' && !e.metaKey && !e.ctrlKey) {
        const idx = parseInt(e.key, 10) - 1
        if (idx >= 0 && idx < DURATIONS.length) {
          e.preventDefault()
          setTargetMinutes(DURATIONS[idx])
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleStart, reset, timerMode])

  if (!task) return null

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Task name */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{task.content}</h2>
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}
        </div>

        {/* Timer mode toggle */}
        <div className="flex items-center justify-center gap-1 rounded-lg bg-muted/40 p-1">
          <button
            onClick={() => setTimerMode('down')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              timerMode === 'down'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Timer className="size-3.5" />
            Countdown
          </button>
          <button
            onClick={() => setTimerMode('up')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              timerMode === 'up'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <TrendingUp className="size-3.5" />
            Stopwatch
          </button>
        </div>

        {/* Duration pills (countdown only) */}
        {timerMode === 'down' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Duration
            </label>
            <div className="flex items-center justify-center gap-2">
              {DURATIONS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setTargetMinutes(d)}
                  className={cn(
                    'flex h-10 w-14 items-center justify-center rounded-lg text-sm font-medium transition-all',
                    targetMinutes === d
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <span>{d}</span>
                  <span className="ml-0.5 text-[10px] opacity-60">m</span>
                </button>
              ))}
            </div>
            <p className="text-center text-[10px] text-muted-foreground/50">
              Press {DURATIONS.map((_, i) => i + 1).join('/')} to select
            </p>
          </div>
        )}

        {/* Break config (countdown only, multi-pomodoro) */}
        {timerMode === 'down' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rounds
              </label>
              <div className="flex items-center justify-center gap-2">
                {POMODORO_COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTotalPomodoros(c)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg text-sm font-medium transition-all',
                      totalPomodoros === c
                        ? 'bg-foreground text-background shadow-sm'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {totalPomodoros > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Break
                </label>
                <div className="flex items-center justify-center gap-2">
                  {BREAK_DURATIONS.map((b) => (
                    <button
                      key={b}
                      onClick={() => setBreakMinutes(b)}
                      className={cn(
                        'flex h-9 w-14 items-center justify-center rounded-lg text-sm font-medium transition-all',
                        breakMinutes === b
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      {b}m
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Start button */}
        <div className="flex justify-center gap-3">
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleStart} className="gap-1.5 px-6">
            <Play className="size-3.5" />
            Start Focus
          </Button>
        </div>
      </div>
    </div>
  )
}
