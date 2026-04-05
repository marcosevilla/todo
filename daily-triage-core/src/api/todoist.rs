use chrono::{Local, NaiveDate};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::types::TodoistTaskRow;

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
    priority: i32,
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

/// Return cached tasks from SQLite sorted by priority then date.
async fn read_cached_tasks(pool: &SqlitePool) -> crate::Result<Vec<TodoistTaskRow>> {
    let rows: Vec<TodoistTaskRow> = sqlx::query_as(
        "SELECT id, content, description, project_id, project_name, priority, due_date,
                due_is_recurring, is_completed, todoist_url
         FROM todoist_tasks
         ORDER BY priority DESC, due_date ASC",
    )
    .fetch_all(pool)
    .await?;
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
async fn do_api_fetch_and_cache(pool: &SqlitePool, token: &str) -> crate::Result<Vec<TodoistTaskRow>> {
    let client = reqwest::Client::new();

    let tasks_future = {
        let client = client.clone();
        let token = token.to_string();
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
                    .map_err(|e| crate::Error::Api(format!("Todoist API error: {}", e)))?
                    .json()
                    .await
                    .map_err(|e| crate::Error::Api(format!("Todoist parse error: {}", e)))?;
                all_tasks.extend(resp.results);
                match resp.next_cursor {
                    Some(c) if !c.is_empty() => cursor = Some(c),
                    _ => break,
                }
            }
            Ok::<Vec<ApiTask>, crate::Error>(all_tasks)
        }
    };

    let projects_future = {
        let client = client.clone();
        let token = token.to_string();
        async move {
            let resp: ApiProjectsResponse = client
                .get("https://api.todoist.com/api/v1/projects")
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await
                .map_err(|e| crate::Error::Api(format!("Todoist projects error: {}", e)))?
                .json()
                .await
                .map_err(|e| crate::Error::Api(format!("Todoist projects parse error: {}", e)))?;
            Ok::<Vec<ApiProject>, crate::Error>(resp.results)
        }
    };

    let (tasks_result, projects_result) = tokio::join!(tasks_future, projects_future);
    let all_tasks = tasks_result?;
    let projects = projects_result.unwrap_or_else(|_| Vec::new());

    let project_map: std::collections::HashMap<String, String> = projects
        .into_iter()
        .map(|p| (p.id, p.name))
        .collect();

    let active: Vec<&ApiTask> = all_tasks
        .iter()
        .filter(|t| !t.checked.unwrap_or(false))
        .collect();

    let today = Local::now().date_naive();
    let cutoff = today - chrono::Duration::days(7);
    let filtered: Vec<&ApiTask> = active
        .into_iter()
        .filter(|t| {
            match t.due.as_ref().and_then(|d| d.date.as_ref()) {
                Some(date_str) => {
                    let date_part = &date_str[..date_str.len().min(10)];
                    match NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                        Ok(d) => d >= cutoff,
                        Err(_) => true,
                    }
                }
                None => true,
            }
        })
        .collect();

    sqlx::query("DELETE FROM todoist_tasks")
        .execute(pool)
        .await?;

    for task in &filtered {
        let due_date = task.due.as_ref().and_then(|d| d.date.clone());
        let is_recurring = task.due.as_ref().and_then(|d| d.is_recurring).unwrap_or(false);
        let todoist_url = format!("https://app.todoist.com/app/task/{}", task.id);
        let project_name = task.project_id.as_ref().and_then(|pid| project_map.get(pid)).cloned();

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
        .execute(pool)
        .await?;
    }

    read_cached_tasks(pool).await
}

/// Fetch Todoist tasks -- returns cached data if fresh, otherwise fetches from API.
pub async fn fetch_todoist_tasks(pool: &SqlitePool, token: &str) -> crate::Result<Vec<TodoistTaskRow>> {
    if is_cache_fresh(pool).await {
        let cached = read_cached_tasks(pool).await?;
        if !cached.is_empty() {
            return Ok(cached);
        }
    }
    do_api_fetch_and_cache(pool, token).await
}

/// Always fetch fresh from Todoist API.
pub async fn refresh_todoist_tasks(pool: &SqlitePool, token: &str) -> crate::Result<Vec<TodoistTaskRow>> {
    do_api_fetch_and_cache(pool, token).await
}

/// Complete a task via Todoist API v1
pub async fn complete_todoist_task(pool: &SqlitePool, token: &str, task_id: &str) -> crate::Result<()> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.todoist.com/api/v1/tasks/{}/close", task_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| crate::Error::Api(format!("Todoist API error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(crate::Error::Api(format!("Todoist close failed: {}", body)));
    }

    sqlx::query("DELETE FROM todoist_tasks WHERE id = ?")
        .bind(task_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO action_log (action_type, target_id, synced, created_at)
         VALUES ('todoist_complete', ?, 1, datetime('now'))",
    )
    .bind(task_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Snooze a task to tomorrow via Todoist API v1
pub async fn snooze_todoist_task(pool: &SqlitePool, token: &str, task_id: &str) -> crate::Result<()> {
    let tomorrow = (Local::now() + chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.todoist.com/api/v1/tasks/{}", task_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "due_date": tomorrow }))
        .send()
        .await
        .map_err(|e| crate::Error::Api(format!("Todoist API error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(crate::Error::Api(format!("Todoist snooze failed: {}", body)));
    }

    sqlx::query("DELETE FROM todoist_tasks WHERE id = ?")
        .bind(task_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO action_log (action_type, target_id, payload, synced, created_at)
         VALUES ('todoist_snooze', ?, ?, 1, datetime('now'))",
    )
    .bind(task_id)
    .bind(&serde_json::json!({ "new_due_date": tomorrow }).to_string())
    .execute(pool)
    .await?;

    Ok(())
}
