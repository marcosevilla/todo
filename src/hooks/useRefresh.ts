import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Auto-refresh hook. Call `triggerRefresh()` for manual refresh.
 * Fires the provided callback every 5 minutes and on manual trigger.
 */
export function useRefresh(refreshFn: () => Promise<void>) {
  const setLastRefreshedAt = useAppStore((s) => s.setLastRefreshedAt)
  const setIsRefreshing = useAppStore((s) => s.setIsRefreshing)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshFn()
      setLastRefreshedAt(new Date().toISOString())
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshFn, setLastRefreshedAt, setIsRefreshing])

  // Auto-refresh on interval
  useEffect(() => {
    intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [doRefresh])

  return { triggerRefresh: doRefresh }
}
