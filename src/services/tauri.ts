import { invoke } from '@tauri-apps/api/core'
import type { Setting } from './types'

// ── Settings ──
export async function checkSetupComplete(): Promise<boolean> {
  return invoke<boolean>('check_setup_complete')
}

export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key })
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>('set_setting', { key, value })
}

export async function getAllSettings(): Promise<Setting[]> {
  return invoke<Setting[]>('get_all_settings')
}

// ── Obsidian ──
export interface CheckboxItem {
  line_number: number
  checked: boolean
  text: string
}

export interface ParsedTodayMd {
  tasks: CheckboxItem[]
  habits_core: CheckboxItem[]
  habits_bonus: CheckboxItem[]
}

export async function readTodayMd(): Promise<ParsedTodayMd> {
  return invoke<ParsedTodayMd>('read_today_md')
}

export async function toggleObsidianCheckbox(
  fileName: string,
  lineNumber: number,
): Promise<ParsedTodayMd> {
  return invoke<ParsedTodayMd>('toggle_obsidian_checkbox', {
    fileName,
    lineNumber,
  })
}

// ── Todoist ──
export interface TodoistTaskRow {
  id: string
  content: string
  description: string | null
  project_id: string | null
  project_name: string | null
  priority: number
  due_date: string | null
  due_is_recurring: number
  is_completed: number
  todoist_url: string | null
}

export async function fetchTodoistTasks(): Promise<TodoistTaskRow[]> {
  return invoke<TodoistTaskRow[]>('fetch_todoist_tasks')
}

export async function completeTodoistTask(taskId: string): Promise<void> {
  return invoke<void>('complete_todoist_task', { taskId })
}

export async function snoozeTodoistTask(taskId: string): Promise<void> {
  return invoke<void>('snooze_todoist_task', { taskId })
}

// ── Calendar ──
export interface CalendarEventRow {
  id: string
  summary: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
  all_day: boolean
  meeting_url: string | null
}

export async function fetchCalendarEvents(): Promise<CalendarEventRow[]> {
  return invoke<CalendarEventRow[]>('fetch_calendar_events')
}

// ── Quick Captures ──
export interface QuickCapture {
  timestamp: string | null
  content: string
}

export async function readQuickCaptures(): Promise<QuickCapture[]> {
  return invoke<QuickCapture[]>('read_quick_captures')
}

// ── Priorities ──
export interface Priority {
  title: string
  source: string
  reasoning: string
}

// ── Progress ──
export interface SaveResult {
  snapshot_id: number
  session_log_path: string
}

export async function saveProgress(
  energyLevel: string,
  tasksCompleted: string,
  tasksOpen: string,
  tasksDeferred: string,
  priorities: string,
): Promise<SaveResult> {
  return invoke<SaveResult>('save_progress', {
    energyLevel,
    tasksCompleted,
    tasksOpen,
    tasksDeferred,
    priorities,
  })
}

// ── Priorities ──
export async function generatePriorities(
  energyLevel: string,
  calendarSummary: string,
  tasksSummary: string,
  obsidianSummary: string,
): Promise<Priority[]> {
  return invoke<Priority[]>('generate_priorities', {
    energyLevel,
    calendarSummary,
    tasksSummary,
    obsidianSummary,
  })
}
