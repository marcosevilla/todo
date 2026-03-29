use sqlx::SqlitePool;
use uuid::Uuid;

/// Log an activity entry. Called internally by command modules.
/// Fire-and-forget: errors are logged but never propagated.
pub async fn log_activity(
    pool: &SqlitePool,
    action_type: &str,
    target_id: Option<&str>,
    metadata: Option<serde_json::Value>,
) {
    let id = Uuid::new_v4().to_string();
    let metadata_str = metadata.map(|m| m.to_string());

    if let Err(e) = sqlx::query(
        "INSERT INTO activity_log (id, action_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))",
    )
    .bind(&id)
    .bind(action_type)
    .bind(target_id)
    .bind(&metadata_str)
    .execute(pool)
    .await
    {
        log::warn!("Failed to log activity '{}': {}", action_type, e);
    }
}
