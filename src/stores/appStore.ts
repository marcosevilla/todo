import { create } from 'zustand'
import type {
  CalendarEvent,
  TodoistTask,
} from '@/services/types'

type Page = 'today' | 'tasks' | 'inbox' | 'session' | 'settings'

interface AppState {
  // Setup
  setupComplete: boolean | null // null = not checked yet
  setSetupComplete: (v: boolean) => void

  // Navigation
  currentPage: Page
  setCurrentPage: (page: Page) => void

  // Data
  calendarEvents: CalendarEvent[]
  setCalendarEvents: (events: CalendarEvent[]) => void

  todoistTasks: TodoistTask[]
  setTodoistTasks: (tasks: TodoistTask[]) => void

  obsidianToday: string | null
  setObsidianToday: (content: string | null) => void

  quickCaptures: string | null
  setQuickCaptures: (content: string | null) => void

  // Quick capture trigger (from tray)
  captureRequested: boolean
  setCaptureRequested: (v: boolean) => void

  // Refresh state
  lastRefreshedAt: string | null
  setLastRefreshedAt: (at: string) => void
  isRefreshing: boolean
  setIsRefreshing: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  setupComplete: null,
  setSetupComplete: (v) => set({ setupComplete: v }),

  currentPage: 'today',
  setCurrentPage: (page) => set({ currentPage: page }),

  calendarEvents: [],
  setCalendarEvents: (events) => set({ calendarEvents: events }),

  todoistTasks: [],
  setTodoistTasks: (tasks) => set({ todoistTasks: tasks }),

  obsidianToday: null,
  setObsidianToday: (content) => set({ obsidianToday: content }),

  quickCaptures: null,
  setQuickCaptures: (content) => set({ quickCaptures: content }),

  captureRequested: false,
  setCaptureRequested: (v) => set({ captureRequested: v }),

  lastRefreshedAt: null,
  setLastRefreshedAt: (at) => set({ lastRefreshedAt: at }),
  isRefreshing: false,
  setIsRefreshing: (v) => set({ isRefreshing: v }),
}))
