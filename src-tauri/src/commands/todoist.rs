use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

// ── API response types ──

#[derive(Debug, Deserialize)]
struct ApiTask {
    id: String,
    content: String,
    description: Option<String>,
    project_id: Option<String>,
    priority: i32,
    due: Option<ApiDue>,
    is_completed: bool,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiDue {
    date: Option<String>,
    is_recurring: Option<bool>,
}

// ── Frontend response types ──

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TodoistTaskRow {
    pub id: String,
    pub content: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub priority: i32,
    pub due_date: Option<String>,
    pub due_is_recurring: i32,
    pub is_completed: i32,
    pub todoist_url: Option<String>,
}

/// Get the API token from settings
async fn get_api_token(app: &AppHandle) -> Result<String, String> {
    let pool = app.state::<SqlitePool>();
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'todoist_api_token'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    row.map(|r| r.0)
        .ok_or_else(|| "Todoist API token not configured".to_string())
}

/// Fetch tasks from Todoist API, filter to today + overdue, cache in SQLite
#[tauri::command]
pub async fn fetch_todoist_tasks(app: AppHandle) -> Result<Vec<TodoistTaskRow>, String> {
    let token = get_api_token(&app).await?;
    let pool = app.state::<SqlitePool>();
    let today = Local::now().format("%Y-%m-%d").to_string();

    // Fetch from API
    let client = reqwest::Client::new();
    let tasks: Vec<ApiTask> = client
        .get("https://api.todoist.com/rest/v2/tasks")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Todoist API error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Todoist parse error: {}", e))?;

    // Filter to today or overdue (tasks with no due date are excluded)
    let today_date = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
        .map_err(|e| e.to_string())?;

    let filtered: Vec<&ApiTask> = tasks
        .iter()
        .filter(|t| {
            if t.is_completed {
                return false;
            }
            if let Some(due) = &t.due {
                if let Some(date_str) = &due.date {
                    // Handle datetime (2026-03-22T10:00:00) and date-only (2026-03-22)
                    let date_part = &date_str[..10.min(date_str.len())];
                    if let Ok(due_date) = NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                        return due_date <= today_date;
                    }
                }
            }
            false
        })
        .collect();

    // Clear old cache and insert fresh data
    sqlx::query("DELETE FROM todoist_tasks")
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    for task in &filtered {
        let due_date = task.due.as_ref().and_then(|d| d.date.clone());
        let is_recurring = task
            .due
            .as_ref()
            .and_then(|d| d.is_recurring)
            .unwrap_or(false);

        sqlx::query(
            "INSERT OR REPLACE INTO todoist_tasks
             (id, content, description, project_id, priority, due_date, due_is_recurring, is_completed, todoist_url, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))",
        )
        .bind(&task.id)
        .bind(&task.content)
        .bind(&task.description)
        .bind(&task.project_id)
        .bind(task.priority)
        .bind(&due_date)
        .bind(is_recurring as i32)
        .bind(&task.url)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    }

    // Return cached tasks sorted by priority (4=urgent in Todoist) then date
    let rows: Vec<TodoistTaskRow> = sqlx::query_as(
        "SELECT id, content, description, project_id, project_name, priority, due_date,
                due_is_recurring, is_completed, todoist_url
         FROM todoist_tasks
         ORDER BY priority DESC, due_date ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Complete a task via Todoist API
#[tauri::command]
pub async fn complete_todoist_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let token = get_api_token(&app).await?;
    let pool = app.state::<SqlitePool>();

    // Call Todoist API
    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "https://api.todoist.com/rest/v2/tasks/{}/close",
            task_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Todoist API error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Todoist returned status {}", resp.status()));
    }

    // Remove from local cache
    sqlx::query("DELETE FROM todoist_tasks WHERE id = ?")
        .bind(&task_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Log action
    sqlx::query(
        "INSERT INTO action_log (action_type, target_id, synced, created_at)
         VALUES ('todoist_complete', ?, 1, datetime('now'))",
    )
    .bind(&task_id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Snooze a task to tomorrow via Todoist API
#[tauri::command]
pub async fn snooze_todoist_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let token = get_api_token(&app).await?;
    let pool = app.state::<SqlitePool>();

    let tomorrow = (Local::now() + chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();

    // Update due date via Todoist API
    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "https://api.todoist.com/rest/v2/tasks/{}",
            task_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "due_date": tomorrow }))
        .send()
        .await
        .map_err(|e| format!("Todoist API error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Todoist returned status {}", resp.status()));
    }

    // Remove from local cache (it's no longer due today)
    sqlx::query("DELETE FROM todoist_tasks WHERE id = ?")
        .bind(&task_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Log action
    sqlx::query(
        "INSERT INTO action_log (action_type, target_id, payload, synced, created_at)
         VALUES ('todoist_snooze', ?, ?, 1, datetime('now'))",
    )
    .bind(&task_id)
    .bind(&serde_json::json!({ "new_due_date": tomorrow }).to_string())
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
