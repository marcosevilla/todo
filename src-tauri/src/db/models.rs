use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub all_day: bool,
    pub meeting_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoistTask {
    pub id: String,
    pub content: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub priority: i32,
    pub due_date: Option<String>,
    pub due_is_recurring: bool,
    pub is_completed: bool,
    pub todoist_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyState {
    pub date: String,
    pub energy_level: String,
    pub top_priorities: Option<String>,
    pub first_opened_at: Option<String>,
    pub last_saved_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressSnapshot {
    pub id: Option<i64>,
    pub energy_level: Option<String>,
    pub tasks_completed: Option<String>,
    pub tasks_open: Option<String>,
    pub tasks_deferred: Option<String>,
    pub priorities: Option<String>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}
