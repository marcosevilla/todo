// Shared TypeScript types matching Rust models

export interface Setting {
  key: string
  value: string
}

export interface CalendarEvent {
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

export interface TodoistTask {
  id: string
  content: string
  description: string | null
  project_id: string | null
  project_name: string | null
  priority: number
  due_date: string | null
  due_is_recurring: boolean
  is_completed: boolean
  todoist_url: string | null
}

export interface DailyState {
  date: string
  top_priorities: string | null
  first_opened_at: string | null
  last_saved_at: string | null
}
