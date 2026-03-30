use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CaptureRoute {
    pub id: String,
    pub prefix: String,
    pub target_type: String,
    pub doc_id: Option<String>,
    pub label: String,
    pub color: String,
    pub icon: String,
    pub position: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RouteCaptureResult {
    pub routed_to: String,
    pub target_type: String,
    pub created_id: String,
    pub label: String,
}

/// List all capture routes
#[tauri::command]
pub async fn get_capture_routes(app: AppHandle) -> Result<Vec<CaptureRoute>, String> {
    let pool = app.state::<SqlitePool>();
    let rows: Vec<(String, String, String, Option<String>, String, String, String, i64, String)> =
        sqlx::query_as(
            "SELECT id, prefix, target_type, doc_id, label, color, icon, position, created_at FROM capture_routes ORDER BY position, created_at",
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

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
#[tauri::command]
pub async fn create_capture_route(
    app: AppHandle,
    prefix: String,
    target_type: String,
    doc_id: Option<String>,
    label: String,
    color: String,
    icon: String,
) -> Result<CaptureRoute, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM capture_routes")
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO capture_routes (id, prefix, target_type, doc_id, label, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&prefix)
    .bind(&target_type)
    .bind(&doc_id)
    .bind(&label)
    .bind(&color)
    .bind(&icon)
    .bind(max_pos + 1)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "capture_route_created",
        Some(&id),
        Some(serde_json::json!({ "prefix": &prefix, "label": &label })),
    )
    .await;

    Ok(CaptureRoute {
        id,
        prefix,
        target_type,
        doc_id,
        label,
        color,
        icon,
        position: max_pos + 1,
        created_at: now,
    })
}

/// Update an existing capture route
#[tauri::command]
pub async fn update_capture_route(
    app: AppHandle,
    id: String,
    prefix: Option<String>,
    target_type: Option<String>,
    doc_id: Option<String>,
    label: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    if let Some(ref v) = prefix {
        sqlx::query("UPDATE capture_routes SET prefix = ? WHERE id = ?")
            .bind(v)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref v) = target_type {
        sqlx::query("UPDATE capture_routes SET target_type = ? WHERE id = ?")
            .bind(v)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref v) = doc_id {
        // Allow setting to empty string to clear doc_id
        let val = if v.is_empty() { None } else { Some(v.as_str()) };
        sqlx::query("UPDATE capture_routes SET doc_id = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref v) = label {
        sqlx::query("UPDATE capture_routes SET label = ? WHERE id = ?")
            .bind(v)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref v) = color {
        sqlx::query("UPDATE capture_routes SET color = ? WHERE id = ?")
            .bind(v)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref v) = icon {
        sqlx::query("UPDATE capture_routes SET icon = ? WHERE id = ?")
            .bind(v)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Delete a capture route
#[tauri::command]
pub async fn delete_capture_route(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    sqlx::query("DELETE FROM capture_routes WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "capture_route_deleted",
        Some(&id),
        None,
    )
    .await;

    Ok(())
}

/// Route a capture: detect prefix, create doc note or task, save to captures history
#[tauri::command]
pub async fn route_capture(
    app: AppHandle,
    prefix: String,
    content: String,
) -> Result<RouteCaptureResult, String> {
    let pool = app.state::<SqlitePool>();

    // Look up the route
    let row: Option<(String, String, String, Option<String>, String, String, String, i64, String)> =
        sqlx::query_as(
            "SELECT id, prefix, target_type, doc_id, label, color, icon, position, created_at FROM capture_routes WHERE prefix = ?",
        )
        .bind(&prefix)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let route = row
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
        .ok_or_else(|| format!("No route found for prefix '{}'", prefix))?;

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let capture_id = Uuid::new_v4().to_string();

    let created_id = if route.target_type == "task" {
        // Create a task in inbox
        let task = super::local_tasks::create_local_task(
            app.clone(),
            content.clone(),
            None,
            None,
            None,
            None,
            None,
        )
        .await?;
        task.id
    } else {
        // Doc route
        let doc_id = if let Some(ref did) = route.doc_id {
            did.clone()
        } else {
            // Auto-create the doc with the route label as title
            let doc = super::docs::create_document(app.clone(), route.label.clone(), None).await?;
            // Update the route to link to this doc
            sqlx::query("UPDATE capture_routes SET doc_id = ? WHERE id = ?")
                .bind(&doc.id)
                .bind(&route.id)
                .execute(pool.inner())
                .await
                .map_err(|e| e.to_string())?;
            doc.id
        };

        // Create a doc note
        let note = super::docs::create_doc_note(app.clone(), doc_id, content.clone()).await?;
        note.id
    };

    // Save to captures table for history
    sqlx::query(
        "INSERT INTO captures (id, content, source, routed_to, created_at) VALUES (?, ?, 'route', ?, ?)",
    )
    .bind(&capture_id)
    .bind(&content)
    .bind(&route.label)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Log activity
    crate::db::activity::log_activity(
        pool.inner(),
        "capture_routed",
        Some(&capture_id),
        Some(serde_json::json!({
            "prefix": &route.prefix,
            "label": &route.label,
            "target_type": &route.target_type,
            "content": &content,
        })),
    )
    .await;

    let label = route.label.clone();
    Ok(RouteCaptureResult {
        routed_to: label.clone(),
        target_type: route.target_type,
        created_id,
        label,
    })
}
