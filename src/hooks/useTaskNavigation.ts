import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'

interface TaskNavActions {
  onComplete: (taskId: string) => void
  onSnooze: (taskId: string) => void
  onOpen: (taskId: string) => void
}

export function useTaskNavigation(
  taskIds: string[],
  actions: TaskNavActions,
  enabled: boolean = true,
) {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const currentPage = useAppStore((s) => s.currentPage)

  const isActive = enabled && (currentPage === 'today' || currentPage === 'tasks')

  useEffect(() => {
    if (!isActive) return

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isInput) return

      // Don't interfere with meta/ctrl shortcuts
      if (e.metaKey || e.ctrlKey) return

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex(prev => Math.min(prev + 1, taskIds.length - 1))
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex(prev => Math.max(prev - 1, 0))
          break
        case 'x':
        case ' ':
          if (focusedIndex >= 0 && focusedIndex < taskIds.length) {
            e.preventDefault()
            actions.onComplete(taskIds[focusedIndex])
          }
          break
        case 's':
          if (focusedIndex >= 0 && focusedIndex < taskIds.length) {
            e.preventDefault()
            actions.onSnooze(taskIds[focusedIndex])
          }
          break
        case 'Enter':
          if (focusedIndex >= 0 && focusedIndex < taskIds.length) {
            e.preventDefault()
            actions.onOpen(taskIds[focusedIndex])
          }
          break
        case 'Escape':
          setFocusedIndex(-1)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, focusedIndex, taskIds, actions])

  // Reset focus when task list changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [taskIds.length])

  return { focusedIndex, setFocusedIndex }
}
