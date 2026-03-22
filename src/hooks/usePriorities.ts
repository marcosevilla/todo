import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { generatePriorities } from '@/services/tauri'
import type { Priority } from '@/services/tauri'

/**
 * Fetches top 3 priorities from Claude API.
 * Collects summaries of today's data from other panels and sends to LLM.
 * Re-triggers when energy level changes.
 */
export function usePriorities() {
  const energyLevel = useAppStore((s) => s.energyLevel)
  const priorities = useAppStore((s) => s.priorities)
  const setPriorities = useAppStore((s) => s.setPriorities)
  const calendarEvents = useAppStore((s) => s.calendarEvents)
  const todoistTasks = useAppStore((s) => s.todoistTasks)
  const obsidianToday = useAppStore((s) => s.obsidianToday)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Build summaries from store data
      const calendarSummary =
        calendarEvents.length > 0
          ? calendarEvents
              .map(
                (e) =>
                  `${e.all_day ? 'All Day' : `${e.start_time}-${e.end_time}`}: ${e.summary}`,
              )
              .join('\n')
          : 'No events today.'

      const tasksSummary =
        todoistTasks.length > 0
          ? todoistTasks
              .map(
                (t) =>
                  `[P${t.priority}] ${t.content}${t.due_date ? ` (due: ${t.due_date})` : ''}`,
              )
              .join('\n')
          : 'No tasks due today.'

      const obsidianSummary = obsidianToday || 'No Obsidian data loaded.'

      const result = await generatePriorities(
        energyLevel,
        calendarSummary,
        tasksSummary,
        obsidianSummary,
      )
      setPriorities(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [
    energyLevel,
    calendarEvents,
    todoistTasks,
    obsidianToday,
    setPriorities,
  ])

  return { priorities, loading, error, refresh }
}
