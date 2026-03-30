import { create } from 'zustand'

export type DetailMode = 'body' | 'sidebar'
export type DetailType = 'task' | 'capture' | 'doc'

export interface DetailTarget {
  type: DetailType
  id: string
}

interface DetailStore {
  target: DetailTarget | null
  mode: DetailMode
  breadcrumbs: DetailTarget[]

  openTask: (taskId: string, mode?: DetailMode) => void
  openCapture: (captureId: string, mode?: DetailMode) => void
  openDoc: (docId: string, mode?: DetailMode) => void
  switchMode: (mode: DetailMode) => void
  drillDown: (target: DetailTarget) => void
  navigateUp: (index?: number) => void
  close: () => void
}

export const useDetailStore = create<DetailStore>((set, get) => ({
  target: null,
  mode: 'body',
  breadcrumbs: [],

  openTask: (taskId, mode = 'body') => {
    set({ target: { type: 'task', id: taskId }, mode, breadcrumbs: [] })
  },

  openCapture: (captureId, mode = 'body') => {
    set({ target: { type: 'capture', id: captureId }, mode, breadcrumbs: [] })
  },

  openDoc: (docId, mode = 'body') => {
    set({ target: { type: 'doc', id: docId }, mode, breadcrumbs: [] })
  },

  switchMode: (mode) => set({ mode }),

  drillDown: (newTarget) => {
    const { target, breadcrumbs } = get()
    if (!target) return
    set({
      breadcrumbs: [...breadcrumbs, target],
      target: newTarget,
    })
  },

  navigateUp: (index) => {
    const { breadcrumbs } = get()
    if (breadcrumbs.length === 0) {
      get().close()
      return
    }
    if (index !== undefined && index >= 0 && index < breadcrumbs.length) {
      // Navigate to specific breadcrumb
      set({
        target: breadcrumbs[index],
        breadcrumbs: breadcrumbs.slice(0, index),
      })
    } else {
      // Go up one level
      const parent = breadcrumbs[breadcrumbs.length - 1]
      set({
        target: parent,
        breadcrumbs: breadcrumbs.slice(0, -1),
      })
    }
  },

  close: () => set({ target: null, breadcrumbs: [] }),
}))
