import { create } from 'zustand'
import { startFocusSession, endFocusSession, completeLocalTask } from '@/services/tauri'
import type { LocalTask } from '@/services/tauri'

export type TimerMode = 'up' | 'down'

export interface FocusConfig {
  timerMode: TimerMode
  targetMinutes: number
  breakMinutes: number
  totalPomodoros: number
}

const DEFAULT_CONFIG: FocusConfig = {
  timerMode: 'down',
  targetMinutes: 25,
  breakMinutes: 5,
  totalPomodoros: 1,
}

interface FocusStore {
  // State
  isActive: boolean
  isPendingSetup: boolean // show setup screen
  taskId: string | null
  task: LocalTask | null
  config: FocusConfig
  startedAt: number | null // ms timestamp
  pausedAt: number | null // ms timestamp
  pausedElapsed: number // seconds accumulated before pause
  elapsed: number // total seconds
  isCompact: boolean
  isOnBreak: boolean
  breakStartedAt: number | null
  breakElapsed: number
  currentPomodoro: number
  showCelebration: boolean
  completedDuration: number | null
  nextTask: LocalTask | null

  // Actions
  beginSetup: (task: LocalTask) => void
  startFocus: (task: LocalTask, config: FocusConfig) => void
  pauseFocus: () => void
  resumeFocus: () => void
  completeFocus: (nextTask: LocalTask | null) => void
  abandonFocus: () => void
  skipFocus: () => void
  setCompact: (compact: boolean) => void
  tick: () => void
  startBreak: () => void
  endBreak: () => void
  dismissCelebration: () => void
  reset: () => void
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  isActive: false,
  isPendingSetup: false,
  taskId: null,
  task: null,
  config: DEFAULT_CONFIG,
  startedAt: null,
  pausedAt: null,
  pausedElapsed: 0,
  elapsed: 0,
  isCompact: false,
  isOnBreak: false,
  breakStartedAt: null,
  breakElapsed: 0,
  currentPomodoro: 1,
  showCelebration: false,
  completedDuration: null,
  nextTask: null,

  beginSetup: (task) => {
    set({
      isPendingSetup: true,
      task,
      taskId: task.id,
      config: DEFAULT_CONFIG,
    })
  },

  startFocus: (task, config) => {
    startFocusSession(task.id, task.content).catch(() => {})
    set({
      isActive: true,
      isPendingSetup: false,
      taskId: task.id,
      task,
      config,
      startedAt: Date.now(),
      pausedAt: null,
      pausedElapsed: 0,
      elapsed: 0,
      isCompact: false,
      isOnBreak: false,
      breakStartedAt: null,
      breakElapsed: 0,
      currentPomodoro: 1,
      showCelebration: false,
      completedDuration: null,
      nextTask: null,
    })
  },

  pauseFocus: () => {
    const { startedAt, pausedElapsed } = get()
    if (!startedAt) return
    const now = Date.now()
    const currentElapsed = pausedElapsed + Math.floor((now - startedAt) / 1000)
    set({ pausedAt: now, pausedElapsed: currentElapsed })
  },

  resumeFocus: () => {
    set({ startedAt: Date.now(), pausedAt: null })
  },

  completeFocus: (nextTask) => {
    const { taskId, elapsed } = get()
    if (taskId) {
      completeLocalTask(taskId).catch(() => {})
      endFocusSession(taskId, 'focus_completed', elapsed).catch(() => {})
    }
    set({
      showCelebration: true,
      completedDuration: elapsed,
      nextTask,
    })
  },

  abandonFocus: () => {
    const { taskId, elapsed } = get()
    if (taskId) {
      endFocusSession(taskId, 'focus_abandoned', elapsed).catch(() => {})
    }
    get().reset()
  },

  skipFocus: () => {
    const { taskId, elapsed } = get()
    if (taskId) {
      endFocusSession(taskId, 'focus_skipped', elapsed).catch(() => {})
    }
    get().reset()
  },

  setCompact: (compact) => set({ isCompact: compact }),

  tick: () => {
    const { startedAt, pausedAt, pausedElapsed, isOnBreak, breakStartedAt } = get()
    if (isOnBreak && breakStartedAt) {
      set({ breakElapsed: Math.floor((Date.now() - breakStartedAt) / 1000) })
      return
    }
    if (!startedAt || pausedAt) return
    set({ elapsed: pausedElapsed + Math.floor((Date.now() - startedAt) / 1000) })
  },

  startBreak: () => {
    set({ isOnBreak: true, breakStartedAt: Date.now(), breakElapsed: 0 })
  },

  endBreak: () => {
    const { currentPomodoro } = get()
    set({
      isOnBreak: false,
      breakStartedAt: null,
      breakElapsed: 0,
      currentPomodoro: currentPomodoro + 1,
      startedAt: Date.now(),
      pausedAt: null,
      pausedElapsed: 0,
      elapsed: 0,
    })
  },

  dismissCelebration: () => {
    const { nextTask, config } = get()
    if (nextTask) {
      // Transition to setup for next task
      set({
        showCelebration: false,
        isActive: false,
        isPendingSetup: true,
        task: nextTask,
        taskId: nextTask.id,
        config,
        completedDuration: null,
        nextTask: null,
      })
    } else {
      get().reset()
    }
  },

  reset: () => {
    set({
      isActive: false,
      isPendingSetup: false,
      taskId: null,
      task: null,
      config: DEFAULT_CONFIG,
      startedAt: null,
      pausedAt: null,
      pausedElapsed: 0,
      elapsed: 0,
      isCompact: false,
      isOnBreak: false,
      breakStartedAt: null,
      breakElapsed: 0,
      currentPomodoro: 1,
      showCelebration: false,
      completedDuration: null,
      nextTask: null,
    })
  },
}))
