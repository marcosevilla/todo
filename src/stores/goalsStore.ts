import { create } from 'zustand'
import { getGoals, getLifeAreas, getHabits } from '@/services/tauri'
import type { GoalWithProgress, LifeArea, HabitWithStats } from '@/services/tauri'

interface GoalsStore {
  goals: GoalWithProgress[]
  lifeAreas: LifeArea[]
  habits: HabitWithStats[]
  goalsLoading: boolean
  habitsLoading: boolean

  loadGoals: () => Promise<void>
  loadLifeAreas: () => Promise<void>
  loadHabits: () => Promise<void>
  refresh: () => Promise<void>
}

export const useGoalsStore = create<GoalsStore>((set, get) => ({
  goals: [],
  lifeAreas: [],
  habits: [],
  goalsLoading: true,
  habitsLoading: true,

  loadGoals: async () => {
    set({ goalsLoading: true })
    try {
      const goals = await getGoals()
      set({ goals, goalsLoading: false })
    } catch {
      set({ goalsLoading: false })
    }
  },

  loadLifeAreas: async () => {
    try {
      const lifeAreas = await getLifeAreas()
      set({ lifeAreas })
    } catch { /* silently fail */ }
  },

  loadHabits: async () => {
    set({ habitsLoading: true })
    try {
      const habits = await getHabits()
      set({ habits, habitsLoading: false })
    } catch {
      set({ habitsLoading: false })
    }
  },

  refresh: async () => {
    await Promise.all([
      get().loadGoals(),
      get().loadLifeAreas(),
      get().loadHabits(),
    ])
  },
}))
