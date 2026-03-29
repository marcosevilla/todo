import { useEffect, useState, useCallback } from 'react'
import { getActiveFocus, getLocalTasks } from '@/services/tauri'
import { useFocusStore, type FocusConfig } from '@/stores/focusStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { LocalTask } from '@/services/tauri'

export function FocusResumeDialog() {
  const [open, setOpen] = useState(false)
  const [resumeTask, setResumeTask] = useState<LocalTask | null>(null)
  const startFocus = useFocusStore((s) => s.startFocus)
  const isActive = useFocusStore((s) => s.isActive)

  useEffect(() => {
    if (isActive) return // Don't check if already focusing
    getActiveFocus().then(async (state) => {
      if (state.task_id && state.started_at) {
        // Find the task
        const tasks = await getLocalTasks({})
        const task = tasks.find((t) => t.id === state.task_id)
        if (task && !task.completed) {
          setResumeTask(task)
          setOpen(true)
        }
      }
    }).catch(() => {})
  }, [isActive])

  const handleResume = useCallback(() => {
    if (!resumeTask) return
    const config: FocusConfig = { timerMode: 'up', targetMinutes: 25, breakMinutes: 5, totalPomodoros: 1 }
    startFocus(resumeTask, config)
    setOpen(false)
  }, [resumeTask, startFocus])

  const handleDismiss = useCallback(() => {
    setOpen(false)
    // The session will be cleared next time a new focus starts
  }, [])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Resume focus?</DialogTitle>
          <DialogDescription>
            You were working on this task.
          </DialogDescription>
        </DialogHeader>
        {resumeTask && (
          <p className="text-sm font-medium">{resumeTask.content}</p>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button size="sm" onClick={handleResume}>
            Resume
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
