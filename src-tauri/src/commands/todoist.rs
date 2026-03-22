use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

// ── Todoist API v1 response types ──

#[derive(Debug, Deserialize)]
struct ApiResponse {
    results: Vec<ApiTask>,
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiTask {
    id: String,
    content: String,
    description: Option<String>,
    project_id: Option<String>,
    priority: i32, // v1: 1=normal, 4=urgent (inverted from v2)
    due: Option<ApiDue>,
    checked: Option<bool>,
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

/// Fetch tasks from Todoist API v1, using server-side filter for today + overdue
#[tauri::command]
pub async fn fetch_todoist_tasks(app: AppHandle) -> Result<Vec<TodoistTaskRow>, String> {
    let token = get_api_token(&app).await?;
    let pool = app.state::<SqlitePool>();

    let client = reqwest::Client::new();
    let mut all_tasks: Vec<ApiTask> = Vec::new();
    let mut cursor: Option<String> = None;

    // Paginate through results
    loop {
        let mut url = "https://api.todoist.com/api/v1/tasks?filter=today%7Coverdue".to_string();
        if let Some(ref c) = cursor {
            url.push_str(&format!("&cursor={}", c));
        }

        let resp: ApiResponse = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(|e| format!("Todoist API error: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Todoist parse error: {}", e))?;

        all_tasks.extend(resp.results);

        match resp.next_cursor {
            Some(c) if !c.is_empty() => cursor = Some(c),
            _ => break,
        }
    }

    // Filter out checked tasks
    let active: Vec<&ApiTask> = all_tasks
        .iter()
        .filter(|t| !t.checked.unwrap_or(false))
        .collect();

    // Clear old cache and insert fresh data
    sqlx::query("DELETE FROM todoist_tasks")
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    for task in &active {
        let due_date = task.due.as_ref().and_then(|d| d.date.clone());
        let is_recurring = task
            .due
            .as_ref()
            .and_then(|d| d.is_recurring)
            .unwrap_or(false);

        // Build Todoist app URL
        let todoist_url = format!("https://app.todoist.com/app/task/{}", task.id);

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
        .bind(&todoist_url)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    }

    // Return cached tasks sorted by priority DESC (4=urgent in v1) then date
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

/// Complete a task via Todoist API v1
#[tauri::command]
pub async fn complete_todoist_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let token = get_api_token(&app).await?;
    let pool = app.state::<SqlitePool>();

    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "https://api.todoist.com/api/v1/tasks/{}/close",
            task_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Todoist API error: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Todoist close failed: {}", body));
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

/// Snooze a task to tomorrow via Todoist API v1
#[tauri::command]
pub async fn snooze_todoist_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let token = get_api_token(&app).await?;
    let pool = app.state::<SqlitePool>();

    let tomorrow = (Local::now() + chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();

    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "https://api.todoist.com/api/v1/tasks/{}",
            task_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "due_date": tomorrow }))
        .send()
        .await
        .map_err(|e| format!("Todoist API error: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Todoist snooze failed: {}", body));
    }

    // Remove from local cache
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
