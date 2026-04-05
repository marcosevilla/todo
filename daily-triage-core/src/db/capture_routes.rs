use chrono::Local;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::activity;
use crate::types::CaptureRoute;

/// List all capture routes
pub async fn get_capture_routes(pool: &SqlitePool) -> crate::Result<Vec<CaptureRoute>> {
    let rows: Vec<(String, String, String, Option<String>, String, String, String, i64, String)> =
        sqlx::query_as(
            "SELECT id, prefix, target_type, doc_id, label, color, icon, position, created_at FROM capture_routes ORDER BY position, created_at",
        )
        .fetch_all(pool)
        .await?;

    Ok(rows
        .into_iter()
        .map(
            |(id, prefix, target_type, doc_id, label, color, icon, position, created_at)| {
                CaptureRoute {
                    id,
                    prefix,
                    target_type,
                    doc_id,
                    label,
                    color,
                    icon,
                    position,
                    created_at,
                }
            },
        )
        .collect())
}

/// Create a new capture route
pub async fn create_capture_route(
    pool: &SqlitePool,
    prefix: &str,
    target_type: &str,
    doc_id: Option<&str>,
    label: &str,
    color: &str,
    icon: &str,
) -> crate::Result<CaptureRoute> {
    let id = Uuid::new_v4().to_string();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM capture_routes")
            .fetch_one(pool)
            .await?;

    sqlx::query(
        "INSERT INTO capture_routes (id, prefix, target_type, doc_id, label, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(prefix)
    .bind(target_type)
    .bind(doc_id)
    .bind(label)
    .bind(color)
    .bind(icon)
    .bind(max_pos + 1)
    .bind(&now)
    .execute(pool)
    .await?;

    activity::log_activity(
        pool,
        "capture_route_created",
        Some(&id),
        Some(serde_json::json!({ "prefix": prefix, "label": label })),
    )
    .await;

    Ok(CaptureRoute {
        id,
        prefix: prefix.to_string(),
        target_type: target_type.to_string(),
        doc_id: doc_id.map(|s| s.to_string()),
        label: label.to_string(),
        color: color.to_string(),
        icon: icon.to_string(),
        position: max_pos + 1,
        created_at: now,
    })
}

/// Update an existing capture route
pub async fn update_capture_route(
    pool: &SqlitePool,
    id: &str,
    prefix: Option<&str>,
    target_type: Option<&str>,
    doc_id: Option<&str>,
    label: Option<&str>,
    color: Option<&str>,
    icon: Option<&str>,
) -> crate::Result<()> {
    if let Some(v) = prefix {
        sqlx::query("UPDATE capture_routes SET prefix = ? WHERE id = ?")
            .bind(v)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(v) = target_type {
        sqlx::query("UPDATE capture_routes SET target_type = ? WHERE id = ?")
            .bind(v)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(v) = doc_id {
        let val: Option<&str> = if v.is_empty() { None } else { Some(v) };
        sqlx::query("UPDATE capture_routes SET doc_id = ? WHERE id = ?")
            .bind(val)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(v) = label {
        sqlx::query("UPDATE capture_routes SET label = ? WHERE id = ?")
            .bind(v)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(v) = color {
        sqlx::query("UPDATE capture_routes SET color = ? WHERE id = ?")
            .bind(v)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(v) = icon {
        sqlx::query("UPDATE capture_routes SET icon = ? WHERE id = ?")
            .bind(v)
            .bind(id)
            .execute(pool)
            .await?;
    }

    Ok(())
}

/// Delete a capture route
pub async fn delete_capture_route(pool: &SqlitePool, id: &str) -> crate::Result<()> {
    sqlx::query("DELETE FROM capture_routes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    activity::log_activity(
        pool,
        "capture_route_deleted",
        Some(id),
        None,
    )
    .await;

    Ok(())
}

/// Look up a route by prefix
pub async fn get_route_by_prefix(pool: &SqlitePool, prefix: &str) -> crate::Result<Option<CaptureRoute>> {
    let row: Option<(String, String, String, Option<String>, String, String, String, i64, String)> =
        sqlx::query_as(
            "SELECT id, prefix, target_type, doc_id, label, color, icon, position, created_at FROM capture_routes WHERE prefix = ?",
        )
        .bind(prefix)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(|(id, prefix, target_type, doc_id, label, color, icon, position, created_at)| {
        CaptureRoute {
            id,
            prefix,
            target_type,
            doc_id,
            label,
            color,
            icon,
            position,
            created_at,
        }
    }))
}

/// Update a route's doc_id
pub async fn link_route_to_doc(pool: &SqlitePool, route_id: &str, doc_id: &str) -> crate::Result<()> {
    sqlx::query("UPDATE capture_routes SET doc_id = ? WHERE id = ?")
        .bind(doc_id)
        .bind(route_id)
        .execute(pool)
        .await?;
    Ok(())
}
