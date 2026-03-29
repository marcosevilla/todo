use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityEntry {
    pub id: String,
    pub action_type: String,
    pub target_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivitySummary {
    pub action_type: String,
    pub count: i64,
}

/// Frontend escape hatch for session-level events (page_viewed, app_opened, etc.)
#[tauri::command]
pub async fn log_activity(
    app: AppHandle,
    action_type: String,
    target_id: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    crate::db::activity::log_activity(
        pool.inner(),
        &action_type,
        target_id.as_deref(),
        metadata,
    )
    .await;
    Ok(())
}

/// Get activity log entries for a date range with optional filters
#[tauri::command]
pub async fn get_activity_log(
    app: AppHandle,
    from_date: String,
    to_date: String,
    action_type: Option<String>,
    target_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<ActivityEntry>, String> {
    let pool = app.state::<SqlitePool>();
    let limit = limit.unwrap_or(200);

    // Build query dynamically based on filters
    let mut conditions = vec!["created_at >= ?", "created_at < date(?, '+1 day')"];
    if action_type.is_some() { conditions.push("action_type = ?"); }
    if target_id.is_some() { conditions.push("target_id = ?"); }

    let sql = format!(
        "SELECT id, action_type, target_id, metadata, created_at FROM activity_log WHERE {} ORDER BY created_at DESC LIMIT ?",
        conditions.join(" AND ")
    );

    let mut query = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, String)>(&sql)
        .bind(&from_date)
        .bind(&to_date);
    if let Some(ref action) = action_type { query = query.bind(action); }
    if let Some(ref tid) = target_id { query = query.bind(tid); }
    query = query.bind(limit);

    let rows = query.fetch_all(pool.inner()).await.map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|(id, action_type, target_id, metadata_str, created_at)| {
            let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());
            ActivityEntry {
                id,
                action_type,
                target_id,
                metadata,
                created_at,
            }
        })
        .collect())
}

/// Get activity counts grouped by action type for a specific date
#[tauri::command]
pub async fn get_activity_summary(
    app: AppHandle,
    date: String,
) -> Result<Vec<ActivitySummary>, String> {
    let pool = app.state::<SqlitePool>();

    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT action_type, COUNT(*) as count FROM activity_log
         WHERE date(created_at) = ? GROUP BY action_type ORDER BY count DESC",
    )
    .bind(&date)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|(action_type, count)| ActivitySummary { action_type, count })
        .collect())
}
