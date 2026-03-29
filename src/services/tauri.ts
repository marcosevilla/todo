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

export async function clearAllSettings(): Promise<void> {
  return invoke<void>('clear_all_settings')
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

export async function refreshTodoistTasks(): Promise<TodoistTaskRow[]> {
  return invoke<TodoistTaskRow[]>('refresh_todoist_tasks')
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
  feed_label: string | null
  feed_color: string | null
}

export interface CalendarFeed {
  id: string
  label: string
  url: string
  color: string
  enabled: number
}

export async function fetchCalendarEvents(): Promise<CalendarEventRow[]> {
  return invoke<CalendarEventRow[]>('fetch_calendar_events')
}

export async function getCalendarFeeds(): Promise<CalendarFeed[]> {
  return invoke<CalendarFeed[]>('get_calendar_feeds')
}

export async function addCalendarFeed(
  label: string,
  url: string,
  color: string,
): Promise<CalendarFeed> {
  return invoke<CalendarFeed>('add_calendar_feed', { label, url, color })
}

export async function removeCalendarFeed(feedId: string): Promise<void> {
  return invoke<void>('remove_calendar_feed', { feedId })
}

// ── Session Log ──
export async function readSessionLog(): Promise<string | null> {
  return invoke<string | null>('read_session_log')
}

// ── Quick Captures ──
export interface QuickCapture {
  timestamp: string | null
  content: string
}

export async function readQuickCaptures(): Promise<QuickCapture[]> {
  return invoke<QuickCapture[]>('read_quick_captures')
}

export async function writeQuickCapture(content: string): Promise<QuickCapture> {
  return invoke<QuickCapture>('write_quick_capture', { content })
}

// ── Priorities ──
export interface Priority {
  title: string
  source: string
  reasoning: string
}

export interface DailyState {
  date: string
  energy_level: string | null
  priorities: Priority[] | null
  review_complete: boolean
}

export async function getDailyState(): Promise<DailyState> {
  return invoke<DailyState>('get_daily_state')
}

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

// ── Projects ──
export interface Project {
  id: string
  name: string
  color: string
  position: number
}

export async function getProjects(): Promise<Project[]> {
  return invoke<Project[]>('get_projects')
}

export async function createProject(name: string, color: string): Promise<Project> {
  return invoke<Project>('create_project', { name, color })
}

export async function updateProject(id: string, name?: string, color?: string): Promise<void> {
  return invoke<void>('update_project', { id, name, color })
}

export async function deleteProject(id: string): Promise<void> {
  return invoke<void>('delete_project', { id })
}

// ── Local Tasks ──
export interface LocalTask {
  id: string
  parent_id: string | null
  content: string
  description: string | null
  project_id: string
  priority: number
  due_date: string | null
  completed: boolean
  completed_at: string | null
  position: number
  created_at: string
  updated_at: string
}

export async function getLocalTasks(opts?: {
  projectId?: string
  dueDate?: string
  includeCompleted?: boolean
}): Promise<LocalTask[]> {
  return invoke<LocalTask[]>('get_local_tasks', {
    projectId: opts?.projectId,
    dueDate: opts?.dueDate,
    includeCompleted: opts?.includeCompleted,
  })
}

export async function createLocalTask(opts: {
  content: string
  projectId?: string
  parentId?: string
  description?: string
  priority?: number
  dueDate?: string
}): Promise<LocalTask> {
  return invoke<LocalTask>('create_local_task', {
    content: opts.content,
    projectId: opts.projectId,
    parentId: opts.parentId,
    description: opts.description,
    priority: opts.priority,
    dueDate: opts.dueDate,
  })
}

export async function updateLocalTask(opts: {
  id: string
  content?: string
  description?: string
  projectId?: string
  priority?: number
  dueDate?: string
  clearDueDate?: boolean
}): Promise<LocalTask> {
  return invoke<LocalTask>('update_local_task', opts)
}

export async function completeLocalTask(id: string): Promise<void> {
  return invoke<void>('complete_local_task', { id })
}

export async function uncompleteLocalTask(id: string): Promise<void> {
  return invoke<void>('uncomplete_local_task', { id })
}

export async function deleteLocalTask(id: string): Promise<void> {
  return invoke<void>('delete_local_task', { id })
}

export async function reorderLocalTasks(taskIds: string[]): Promise<void> {
  return invoke<void>('reorder_local_tasks', { taskIds })
}

// ── Open URL ──
export async function openUrl(url: string): Promise<void> {
  return invoke<void>('open_url', { url })
}

// ── Updater ──
export interface UpdateStatus {
  current_version: string
  latest_version: string | null
  update_available: boolean
  release_url: string | null
  error: string | null
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  return invoke<UpdateStatus>('check_for_updates')
}

// ── Progress ──
export interface SaveResult {
  snapshot_id: number
  session_log_path: string
}

export async function saveProgress(
  tasksCompleted: string,
  tasksOpen: string,
  tasksDeferred: string,
): Promise<SaveResult> {
  return invoke<SaveResult>('save_progress', {
    tasksCompleted,
    tasksOpen,
    tasksDeferred,
  })
}

// ── Activity Log ──

export interface ActivityEntry {
  id: string
  action_type: string
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ActivitySummary {
  action_type: string
  count: number
}

export async function logActivity(
  actionType: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return invoke<void>('log_activity', { actionType, targetId, metadata })
}

export async function getActivityLog(opts: {
  fromDate: string
  toDate: string
  actionType?: string
  limit?: number
}): Promise<ActivityEntry[]> {
  return invoke<ActivityEntry[]>('get_activity_log', {
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    actionType: opts.actionType,
    limit: opts.limit,
  })
}

export async function getActivitySummary(date: string): Promise<ActivitySummary[]> {
  return invoke<ActivitySummary[]>('get_activity_summary', { date })
}

// ── AI ──

export async function breakDownTask(taskContent: string, taskDescription?: string): Promise<string[]> {
  return invoke<string[]>('break_down_task', { taskContent, taskDescription })
}

// ── Focus Mode ──

export interface FocusState {
  task_id: string | null
  started_at: string | null
  paused_at: string | null
}

export async function startFocusSession(taskId: string, taskContent: string): Promise<void> {
  return invoke<void>('start_focus_session', { taskId, taskContent })
}

export async function endFocusSession(taskId: string, outcome: string, durationSecs: number): Promise<void> {
  return invoke<void>('end_focus_session', { taskId, outcome, durationSecs: Math.floor(durationSecs) })
}

export async function getActiveFocus(): Promise<FocusState> {
  return invoke<FocusState>('get_active_focus')
}
