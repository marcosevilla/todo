use chrono::{Local, NaiveDate};
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

#[derive(Debug, Deserialize)]
struct ApiProject {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct ApiProjectsResponse {
    results: Vec<ApiProject>,
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

/// Return cached tasks from SQLite sorted by priority then date.
async fn read_cached_tasks(pool: &SqlitePool) -> Result<Vec<TodoistTaskRow>, String> {
    let rows: Vec<TodoistTaskRow> = sqlx::query_as(
        "SELECT id, content, description, project_id, project_name, priority, due_date,
                due_is_recurring, is_completed, todoist_url
         FROM todoist_tasks
         ORDER BY priority DESC, due_date ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Check if the cache is fresh (fetched within the last 24 hours).
async fn is_cache_fresh(pool: &SqlitePool) -> bool {
    let row: Option<(i32,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM todoist_tasks
         WHERE fetched_at > datetime('now', '-24 hours')",
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);
    matches!(row, Some((count,)) if count > 0)
}

/// Fetch tasks from Todoist API, apply filters, and write to SQLite cache.
/// Returns the fresh task list.
async fn do_api_fetch_and_cache(app: &AppHandle) -> Result<Vec<TodoistTaskRow>, String> {
    let token = get_api_token(app).await?;
    let pool = app.state::<SqlitePool>();

    let client = reqwest::Client::new();

    // Fetch tasks and projects CONCURRENTLY
    let tasks_future = {
        let client = client.clone();
        let token = token.clone();
        async move {
            let mut all_tasks: Vec<ApiTask> = Vec::new();
            let mut cursor: Option<String> = None;
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
            Ok::<Vec<ApiTask>, String>(all_tasks)
        }
    };

    let projects_future = {
        let client = client.clone();
        let token = token.clone();
        async move {
            let resp: ApiProjectsResponse = client
                .get("https://api.todoist.com/api/v1/projects")
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await
                .map_err(|e| format!("Todoist projects error: {}", e))?
                .json()
                .await
                .map_err(|e| format!("Todoist projects parse error: {}", e))?;
            Ok::<Vec<ApiProject>, String>(resp.results)
        }
    };

    let (tasks_result, projects_result) = tokio::join!(tasks_future, projects_future);
    let all_tasks = tasks_result?;
    let projects = projects_result.unwrap_or_else(|_| Vec::new());

    // Build project ID → name map
    let project_map: std::collections::HashMap<String, String> = projects
        .into_iter()
        .map(|p| (p.id, p.name))
        .collect();

    // Filter out checked tasks
    let active: Vec<&ApiTask> = all_tasks
        .iter()
        .filter(|t| !t.checked.unwrap_or(false))
        .collect();

    // Filter to 7-day overdue window: keep tasks with no due_date,
    // or due_date >= (today - 7 days)
    let today = Local::now().date_naive();
    let cutoff = today - chrono::Duration::days(7);
    let filtered: Vec<&ApiTask> = active
        .into_iter()
        .filter(|t| {
            match t.due.as_ref().and_then(|d| d.date.as_ref()) {
                Some(date_str) => {
                    // Parse YYYY-MM-DD (Todoist may also send datetime, take first 10 chars)
                    let date_part = &date_str[..date_str.len().min(10)];
                    match NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                        Ok(d) => d >= cutoff,
                        Err(_) => true, // If we can't parse, keep the task
                    }
                }
                None => true, // No due date → keep
            }
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

        // Build Todoist app URL
        let todoist_url = format!("https://app.todoist.com/app/task/{}", task.id);

        // Look up project name from the map
        let project_name = task
            .project_id
            .as_ref()
            .and_then(|pid| project_map.get(pid))
            .cloned();

        sqlx::query(
            "INSERT OR REPLACE INTO todoist_tasks
             (id, content, description, project_id, project_name, priority, due_date, due_is_recurring, is_completed, todoist_url, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))",
        )
        .bind(&task.id)
        .bind(&task.content)
        .bind(&task.description)
        .bind(&task.project_id)
        .bind(&project_name)
        .bind(task.priority)
        .bind(&due_date)
        .bind(is_recurring as i32)
        .bind(&todoist_url)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    }

    // Return the freshly cached tasks
    read_cached_tasks(pool.inner()).await
}

/// Fetch Todoist tasks — returns cached data if fresh (< 24h), otherwise fetches from API.
#[tauri::command]
pub async fn fetch_todoist_tasks(app: AppHandle) -> Result<Vec<TodoistTaskRow>, String> {
    let pool = app.state::<SqlitePool>();

    // Return cache if it exists and is fresh
    if is_cache_fresh(pool.inner()).await {
        let cached = read_cached_tasks(pool.inner()).await?;
        if !cached.is_empty() {
            return Ok(cached);
        }
    }

    // No cache or stale — fall through to API fetch
    do_api_fetch_and_cache(&app).await
}

/// Always fetch fresh from Todoist API, update the cache, and return fresh data.
/// The frontend calls this in the background after displaying cached data.
#[tauri::command]
pub async fn refresh_todoist_tasks(app: AppHandle) -> Result<Vec<TodoistTaskRow>, String> {
    do_api_fetch_and_cache(&app).await
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
