use sqlx::SqlitePool;

use crate::db::activity;
use crate::types::FocusState;

/// Start a focus session -- persists to daily_state + logs activity
pub async fn start_focus_session(
    pool: &SqlitePool,
    task_id: &str,
    task_content: &str,
) -> crate::Result<()> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO daily_state (date, focus_task_id, focus_started_at)
         VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET focus_task_id = excluded.focus_task_id, focus_started_at = excluded.focus_started_at, focus_paused_at = NULL",
    )
    .bind(&today)
    .bind(task_id)
    .bind(&now)
    .execute(pool)
    .await?;

    activity::log_activity(
        pool,
        "focus_started",
        Some(task_id),
        Some(serde_json::json!({ "task_content": task_content })),
    )
    .await;

    Ok(())
}

/// End a focus session -- clears daily_state + logs outcome
pub async fn end_focus_session(
    pool: &SqlitePool,
    task_id: &str,
    outcome: &str,
    duration_secs: i64,
) -> crate::Result<()> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "UPDATE daily_state SET focus_task_id = NULL, focus_started_at = NULL, focus_paused_at = NULL WHERE date = ?",
    )
    .bind(&today)
    .execute(pool)
    .await?;

    activity::log_activity(
        pool,
        outcome,
        Some(task_id),
        Some(serde_json::json!({ "duration_secs": duration_secs })),
    )
    .await;

    Ok(())
}

/// Get active focus session (for resume on app reopen)
pub async fn get_active_focus(pool: &SqlitePool) -> crate::Result<FocusState> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let row: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT focus_task_id, focus_started_at, focus_paused_at FROM daily_state WHERE date = ?",
    )
    .bind(&today)
    .fetch_optional(pool)
    .await?;

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
