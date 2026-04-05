use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;

use crate::types::{SyncLogEntry, SyncStatus};

/// Append a sync log entry after a local mutation.
/// This is fire-and-forget: callers use `.ok()` so sync failures
/// never break the primary mutation.
pub async fn append_sync_log(
    pool: &SqlitePool,
    table_name: &str,
    row_id: &str,
    operation: &str,
    changed_columns: Option<&str>,
    snapshot: Option<&str>,
) -> crate::Result<()> {
    let device_id = get_or_create_device_id(pool).await?;
    let id = Uuid::new_v4().to_string();
    let timestamp = Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

    sqlx::query(
        "INSERT INTO sync_log (id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)"
    )
    .bind(&id)
    .bind(table_name)
    .bind(row_id)
    .bind(operation)
    .bind(changed_columns)
    .bind(snapshot)
    .bind(&device_id)
    .bind(&timestamp)
    .execute(pool)
    .await?;

    Ok(())
}

/// Get device_id from settings, or create one on first run.
pub async fn get_or_create_device_id(pool: &SqlitePool) -> crate::Result<String> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM settings WHERE key = 'device_id'",
    )
    .fetch_optional(pool)
    .await?;

    if let Some((device_id,)) = row {
        return Ok(device_id);
    }

    // Generate and persist a new device_id
    let device_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES ('device_id', ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    )
    .bind(&device_id)
    .execute(pool)
    .await?;

    Ok(device_id)
}

/// Push unsynced local entries to Turso via its HTTP API.
/// Returns the count of entries pushed.
pub async fn push(pool: &SqlitePool, turso_url: &str, turso_token: &str) -> crate::Result<u64> {
    // Fetch all unsynced entries
    let entries: Vec<(String, String, String, String, Option<String>, Option<String>, String, String)> =
        sqlx::query_as(
            "SELECT id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp
             FROM sync_log WHERE synced = 0 ORDER BY timestamp"
        )
        .fetch_all(pool)
        .await?;

    if entries.is_empty() {
        return Ok(0);
    }

    // Build batch of INSERT statements for Turso
    let mut statements: Vec<serde_json::Value> = Vec::new();
    let mut pushed_ids: Vec<String> = Vec::new();

    for (id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp) in &entries {
        statements.push(serde_json::json!({
            "type": "execute",
            "stmt": {
                "sql": "INSERT OR IGNORE INTO sync_log (id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                "args": [
                    { "type": "text", "value": id },
                    { "type": "text", "value": table_name },
                    { "type": "text", "value": row_id },
                    { "type": "text", "value": operation },
                    match changed_columns {
                        Some(v) => serde_json::json!({ "type": "text", "value": v }),
                        None => serde_json::json!({ "type": "null" }),
                    },
                    match snapshot {
                        Some(v) => serde_json::json!({ "type": "text", "value": v }),
                        None => serde_json::json!({ "type": "null" }),
                    },
                    { "type": "text", "value": device_id },
                    { "type": "text", "value": timestamp },
                ]
            }
        }));
        pushed_ids.push(id.clone());
    }

    // Add a "close" to end the pipeline
    statements.push(serde_json::json!({ "type": "close" }));

    let client = reqwest::Client::new();
    let url = format!("{}/v2/pipeline", turso_url.trim_end_matches('/'));

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", turso_token))
        .json(&serde_json::json!({ "requests": statements }))
        .send()
        .await
        .map_err(|e| crate::Error::Api(format!("Turso push failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(crate::Error::Api(format!(
            "Turso push returned {}: {}", status, body
        )));
    }

    // Mark local entries as synced
    let count = pushed_ids.len() as u64;
    for id in &pushed_ids {
        sqlx::query("UPDATE sync_log SET synced = 1 WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
    }

    Ok(count)
}

/// Pull remote changes from Turso that originated on other devices.
/// Applies each change to the local DB using last-write-wins.
/// Returns the count of applied entries.
pub async fn pull(pool: &SqlitePool, turso_url: &str, turso_token: &str) -> crate::Result<u64> {
    let device_id = get_or_create_device_id(pool).await?;

    // Get last pull timestamp from settings
    let last_pull: String = sqlx::query_scalar(
        "SELECT COALESCE((SELECT value FROM settings WHERE key = 'last_pull_timestamp'), '1970-01-01T00:00:00.000Z')"
    )
    .fetch_one(pool)
    .await?;

    // Query Turso for entries from other devices since last pull
    let client = reqwest::Client::new();
    let url = format!("{}/v2/pipeline", turso_url.trim_end_matches('/'));

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", turso_token))
        .json(&serde_json::json!({
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": "SELECT id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp FROM sync_log WHERE timestamp > ? AND device_id != ? ORDER BY timestamp",
                        "args": [
                            { "type": "text", "value": &last_pull },
                            { "type": "text", "value": &device_id },
                        ]
                    }
                },
                { "type": "close" }
            ]
        }))
        .send()
        .await
        .map_err(|e| crate::Error::Api(format!("Turso pull failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(crate::Error::Api(format!(
            "Turso pull returned {}: {}", status, body
        )));
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|e| crate::Error::Api(format!("Turso pull parse failed: {}", e)))?;

    // Parse the pipeline response: results[0].response.result.rows
    let rows = body
        .pointer("/results/0/response/result/rows")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut applied: u64 = 0;
    let mut max_timestamp = last_pull.clone();

    for row in &rows {
        let cols = match row.as_array() {
            Some(c) => c,
            None => continue,
        };

        // Each column is { "type": "text", "value": "..." } or { "type": "null" }
        let get_text = |idx: usize| -> Option<String> {
            cols.get(idx)
                .and_then(|c| c.get("value"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        let entry_id = match get_text(0) { Some(v) => v, None => continue };
        let table_name = match get_text(1) { Some(v) => v, None => continue };
        let row_id = match get_text(2) { Some(v) => v, None => continue };
        let operation = match get_text(3) { Some(v) => v, None => continue };
        let changed_columns = get_text(4);
        let snapshot = get_text(5);
        let remote_device_id = match get_text(6) { Some(v) => v, None => continue };
        let timestamp = match get_text(7) { Some(v) => v, None => continue };

        // Apply the change locally
        if let Err(e) = apply_remote_change(pool, &table_name, &row_id, &operation, snapshot.as_deref()).await {
            log::warn!("Failed to apply remote change {}: {}", entry_id, e);
            continue;
        }

        // Record entry in local sync_log as already synced (so we don't push it back)
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO sync_log (id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp, synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
        )
        .bind(&entry_id)
        .bind(&table_name)
        .bind(&row_id)
        .bind(&operation)
        .bind(&changed_columns)
        .bind(&snapshot)
        .bind(&remote_device_id)
        .bind(&timestamp)
        .execute(pool)
        .await;

        if timestamp > max_timestamp {
            max_timestamp = timestamp;
        }
        applied += 1;
    }

    // Update last_pull_timestamp
    if applied > 0 {
        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES ('last_pull_timestamp', ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
        )
        .bind(&max_timestamp)
        .execute(pool)
        .await?;
    }

    Ok(applied)
}

/// Apply a single remote change to the local database.
/// Uses last-write-wins: the snapshot contains the full row state.
async fn apply_remote_change(
    pool: &SqlitePool,
    table_name: &str,
    row_id: &str,
    operation: &str,
    snapshot: Option<&str>,
) -> crate::Result<()> {
    match operation {
        "DELETE" => {
            let sql = format!("DELETE FROM {} WHERE id = ?", sanitize_table_name(table_name)?);
            sqlx::query(&sql).bind(row_id).execute(pool).await?;
        }
        "INSERT" | "UPDATE" => {
            let snapshot = snapshot.ok_or_else(|| {
                crate::Error::Other("Missing snapshot for INSERT/UPDATE".to_string())
            })?;

            let row: serde_json::Value = serde_json::from_str(snapshot)
                .map_err(|e| crate::Error::Other(format!("Invalid snapshot JSON: {}", e)))?;

            let obj = row.as_object().ok_or_else(|| {
                crate::Error::Other("Snapshot is not a JSON object".to_string())
            })?;

            // Build an UPSERT: INSERT OR REPLACE
            let columns: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
            let placeholders: Vec<&str> = columns.iter().map(|_| "?").collect();

            let sql = format!(
                "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                sanitize_table_name(table_name)?,
                columns.join(", "),
                placeholders.join(", ")
            );

            let mut query = sqlx::query(&sql);
            for col in &columns {
                let val = &obj[*col];
                match val {
                    serde_json::Value::Null => { query = query.bind(None::<String>); }
                    serde_json::Value::Bool(b) => { query = query.bind(if *b { 1i64 } else { 0i64 }); }
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            query = query.bind(i);
                        } else if let Some(f) = n.as_f64() {
                            query = query.bind(f);
                        }
                    }
                    serde_json::Value::String(s) => { query = query.bind(s.clone()); }
                    other => { query = query.bind(other.to_string()); }
                }
            }

            query.execute(pool).await?;
        }
        _ => {
            log::warn!("Unknown sync operation: {}", operation);
        }
    }

    Ok(())
}

/// Only allow known table names to prevent SQL injection.
fn sanitize_table_name(name: &str) -> crate::Result<&str> {
    const ALLOWED: &[&str] = &[
        "local_tasks",
        "projects",
        "captures",
        "goals",
        "milestones",
        "habits",
        "habit_logs",
        "daily_state",
        "activity_log",
        "documents",
        "doc_folders",
        "doc_notes",
        "capture_routes",
        "life_areas",
        "calendar_feeds",
    ];

    if ALLOWED.contains(&name) {
        Ok(name)
    } else {
        Err(crate::Error::Other(format!(
            "Table '{}' is not allowed for sync", name
        )))
    }
}

/// Get current sync status: pending changes, last sync time, device_id.
pub async fn get_sync_status(pool: &SqlitePool) -> crate::Result<SyncStatus> {
    let pending_changes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_log WHERE synced = 0"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let last_sync: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'last_pull_timestamp'"
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let device_id = get_or_create_device_id(pool).await?;

    Ok(SyncStatus {
        pending_changes,
        last_sync,
        device_id,
    })
}

/// Get unsynced sync log entries (for diagnostics).
pub async fn get_pending_entries(pool: &SqlitePool) -> crate::Result<Vec<SyncLogEntry>> {
    let rows: Vec<(String, String, String, String, Option<String>, Option<String>, String, String, i64)> =
        sqlx::query_as(
            "SELECT id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp, synced
             FROM sync_log WHERE synced = 0 ORDER BY timestamp LIMIT 100"
        )
        .fetch_all(pool)
        .await?;

    Ok(rows.into_iter().map(|(id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp, synced)| {
        SyncLogEntry {
            id,
            table_name,
            row_id,
            operation,
            changed_columns,
            snapshot,
            device_id,
            timestamp,
            synced: synced != 0,
        }
    }).collect())
}
