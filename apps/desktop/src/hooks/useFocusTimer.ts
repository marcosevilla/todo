import { useEffect } from 'react'
import { useFocusStore } from '@/stores/focusStore'

export function useFocusTimer() {
  const isActive = useFocusStore((s) => s.isActive)
  const pausedAt = useFocusStore((s) => s.pausedAt)
  const tick = useFocusStore((s) => s.tick)

  useEffect(() => {
    if (!isActive || pausedAt) return

    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isActive, pausedAt, tick])
}
