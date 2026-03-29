use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FocusState {
    pub task_id: Option<String>,
    pub started_at: Option<String>,
    pub paused_at: Option<String>,
}

/// Start a focus session — persists to daily_state + logs activity
#[tauri::command]
pub async fn start_focus_session(
    app: AppHandle,
    task_id: String,
    task_content: String,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Ensure daily_state row exists
    sqlx::query(
        "INSERT INTO daily_state (date, focus_task_id, focus_started_at)
         VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET focus_task_id = excluded.focus_task_id, focus_started_at = excluded.focus_started_at, focus_paused_at = NULL",
    )
    .bind(&today)
    .bind(&task_id)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "focus_started",
        Some(&task_id),
        Some(serde_json::json!({ "task_content": &task_content })),
    )
    .await;

    Ok(())
}

/// End a focus session — clears daily_state + logs outcome
#[tauri::command]
pub async fn end_focus_session(
    app: AppHandle,
    task_id: String,
    outcome: String,
    duration_secs: i64,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Clear focus state
    sqlx::query(
        "UPDATE daily_state SET focus_task_id = NULL, focus_started_at = NULL, focus_paused_at = NULL WHERE date = ?",
    )
    .bind(&today)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        &outcome,
        Some(&task_id),
        Some(serde_json::json!({ "duration_secs": duration_secs })),
    )
    .await;

    Ok(())
}

/// Get active focus session (for resume on app reopen)
#[tauri::command]
pub async fn get_active_focus(app: AppHandle) -> Result<FocusState, String> {
    let pool = app.state::<SqlitePool>();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let row: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT focus_task_id, focus_started_at, focus_paused_at FROM daily_state WHERE date = ?",
    )
    .bind(&today)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some((task_id, started_at, paused_at)) => Ok(FocusState {
            task_id,
            started_at,
            paused_at,
        }),
        None => Ok(FocusState {
            task_id: None,
            started_at: None,
            paused_at: None,
        }),
    }
}
