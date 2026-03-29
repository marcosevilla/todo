use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Capture {
    pub id: String,
    pub content: String,
    pub source: String,
    pub converted_to_task_id: Option<String>,
    pub created_at: String,
}

/// Get captures from SQLite, newest first
#[tauri::command]
pub async fn get_captures(
    app: AppHandle,
    limit: Option<i64>,
    include_converted: Option<bool>,
) -> Result<Vec<Capture>, String> {
    let pool = app.state::<SqlitePool>();
    let limit = limit.unwrap_or(50);
    let include_converted = include_converted.unwrap_or(false);

    let rows: Vec<(String, String, String, Option<String>, String)> = if include_converted {
        sqlx::query_as(
            "SELECT id, content, source, converted_to_task_id, created_at FROM captures ORDER BY created_at DESC LIMIT ?",
        )
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(
            "SELECT id, content, source, converted_to_task_id, created_at FROM captures WHERE converted_to_task_id IS NULL ORDER BY created_at DESC LIMIT ?",
        )
        .bind(limit)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(rows
        .into_iter()
        .map(|(id, content, source, converted_to_task_id, created_at)| Capture {
            id,
            content,
            source,
            converted_to_task_id,
            created_at,
        })
        .collect())
}

/// Create a new capture in SQLite + backup to Obsidian
#[tauri::command]
pub async fn create_capture(
    app: AppHandle,
    content: String,
    source: Option<String>,
) -> Result<Capture, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let source = source.unwrap_or_else(|| "manual".to_string());
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO captures (id, content, source, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&content)
    .bind(&source)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Backup to Obsidian (fire-and-forget)
    let _ = write_obsidian_backup(&app, &content).await;

    crate::db::activity::log_activity(
        pool.inner(),
        "item_captured",
        Some(&id),
        Some(serde_json::json!({ "content": &content, "source": &source })),
    )
    .await;

    Ok(Capture {
        id,
        content,
        source,
        converted_to_task_id: None,
        created_at: now,
    })
}

/// Convert a capture to a task
#[tauri::command]
pub async fn convert_capture_to_task(
    app: AppHandle,
    capture_id: String,
    project_id: Option<String>,
) -> Result<super::local_tasks::LocalTask, String> {
    let pool = app.state::<SqlitePool>();

    // Get the capture
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT id, content FROM captures WHERE id = ?",
    )
    .bind(&capture_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (_, content) = row.ok_or_else(|| "Capture not found".to_string())?;

    // Create the task
    let task = super::local_tasks::create_local_task(
        app.clone(),
        content,
        project_id,
        None, None, None, None,
    )
    .await?;

    // Mark capture as converted
    sqlx::query(
        "UPDATE captures SET converted_to_task_id = ? WHERE id = ?",
    )
    .bind(&task.id)
    .bind(&capture_id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "capture_converted",
        Some(&capture_id),
        Some(serde_json::json!({ "task_id": &task.id })),
    )
    .await;

    Ok(task)
}

/// Delete a capture
#[tauri::command]
pub async fn delete_capture(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    sqlx::query("DELETE FROM captures WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Import captures from Obsidian Quick Captures.md into SQLite
#[tauri::command]
pub async fn import_obsidian_captures(app: AppHandle) -> Result<i64, String> {
    let pool = app.state::<SqlitePool>();

    // Get vault path
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'obsidian_vault_path'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    let vault_path = row
        .map(|r| r.0)
        .ok_or_else(|| "Obsidian vault path not configured".to_string())?;

    let vault_path = if vault_path.starts_with('~') {
        let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
        vault_path.replacen('~', &home.to_string_lossy(), 1)
    } else {
        vault_path
    };

    let file_path = format!("{}/inbox/Quick Captures.md", vault_path);
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read Quick Captures.md: {}", e))?;

    // Parse entries (separated by ---)
    let mut imported = 0i64;
    let mut in_body = false;
    let mut header_count = 0;
    let mut current_lines: Vec<&str> = Vec::new();

    for line in content.lines() {
        if line.trim() == "---" {
            if !in_body {
                header_count += 1;
                if header_count >= 2 {
                    in_body = true;
                }
                continue;
            }
            // Process accumulated lines
            if !current_lines.is_empty() {
                let entry = current_lines.join("\n").trim().to_string();
                if !entry.is_empty() {
                    if insert_capture_if_new(pool.inner(), &entry).await {
                        imported += 1;
                    }
                }
            }
            current_lines.clear();
            continue;
        }
        if in_body {
            current_lines.push(line);
        }
    }

    // Last entry
    if !current_lines.is_empty() {
        let entry = current_lines.join("\n").trim().to_string();
        if !entry.is_empty() {
            if insert_capture_if_new(pool.inner(), &entry).await {
                imported += 1;
            }
        }
    }

    Ok(imported)
}

/// Insert a capture if no existing capture has the same content
async fn insert_capture_if_new(pool: &SqlitePool, content: &str) -> bool {
    // Skip if content already exists
    let exists: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM captures WHERE content = ?",
    )
    .bind(content)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if exists.map(|r| r.0).unwrap_or(0) > 0 {
        return false;
    }

    // Strip timestamp line if present (first line with year + AM/PM)
    let lines: Vec<&str> = content.lines().collect();
    let (actual_content, _timestamp) = if !lines.is_empty() {
        let first = lines[0].trim();
        if first.contains("202") && (first.contains("AM") || first.contains("PM")) {
            (lines[1..].join("\n").trim().to_string(), Some(first.to_string()))
        } else {
            (content.to_string(), None)
        }
    } else {
        (content.to_string(), None)
    };

    if actual_content.is_empty() {
        return false;
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO captures (id, content, source, created_at) VALUES (?, ?, 'obsidian_import', datetime('now', 'localtime'))",
    )
    .bind(&id)
    .bind(&actual_content)
    .execute(pool)
    .await
    .is_ok()
}

/// Write a backup copy to Obsidian Quick Captures.md
async fn write_obsidian_backup(app: &AppHandle, content: &str) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'obsidian_vault_path'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    let vault_path = match row {
        Some(r) => r.0,
        None => return Ok(()), // No vault configured, skip silently
    };

    let vault_path = if vault_path.starts_with('~') {
        let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
        vault_path.replacen('~', &home.to_string_lossy(), 1)
    } else {
        vault_path
    };

    let file_path = format!("{}/inbox/Quick Captures.md", vault_path);
    let inbox_dir = format!("{}/inbox", vault_path);
    let _ = tokio::fs::create_dir_all(&inbox_dir).await;

    let timestamp = Local::now().format("%B %d, %Y at %I:%M %p").to_string();
    let new_entry = format!("\n---\n\n{}\n{}\n", timestamp, content.trim());

    let existing = match tokio::fs::read_to_string(&file_path).await {
        Ok(c) => c,
        Err(_) => "---\ntags: inbox\n---\n".to_string(),
    };

    let updated = format!("{}{}", existing.trim_end(), new_entry);
    tokio::fs::write(&file_path, &updated)
        .await
        .map_err(|e| format!("Failed to write Obsidian backup: {}", e))?;

    Ok(())
}
