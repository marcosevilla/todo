use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalTask {
    pub id: String,
    pub parent_id: Option<String>,
    pub content: String,
    pub description: Option<String>,
    pub project_id: String,
    pub priority: i64,
    pub due_date: Option<String>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_task(
    row: (
        String,
        Option<String>,
        String,
        Option<String>,
        String,
        i64,
        Option<String>,
        i64,
        Option<String>,
        i64,
        String,
        String,
    ),
) -> LocalTask {
    LocalTask {
        id: row.0,
        parent_id: row.1,
        content: row.2,
        description: row.3,
        project_id: row.4,
        priority: row.5,
        due_date: row.6,
        completed: row.7 != 0,
        completed_at: row.8,
        position: row.9,
        created_at: row.10,
        updated_at: row.11,
    }
}

/// Reorder tasks within a project — receives ordered list of task IDs
#[tauri::command]
pub async fn reorder_local_tasks(app: AppHandle, task_ids: Vec<String>) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    for (i, id) in task_ids.iter().enumerate() {
        sqlx::query("UPDATE local_tasks SET position = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(i as i64)
            .bind(id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

const SELECT_COLS: &str = "id, parent_id, content, description, project_id, priority, due_date, completed, completed_at, position, created_at, updated_at";

#[tauri::command]
pub async fn get_local_tasks(
    app: AppHandle,
    project_id: Option<String>,
    due_date: Option<String>,
    include_completed: Option<bool>,
) -> Result<Vec<LocalTask>, String> {
    let pool = app.state::<SqlitePool>();
    let include_completed = include_completed.unwrap_or(false);

    let query = if let Some(pid) = &project_id {
        if include_completed {
            format!(
                "SELECT {} FROM local_tasks WHERE project_id = ? ORDER BY completed, position, created_at",
                SELECT_COLS
            )
        } else {
            format!(
                "SELECT {} FROM local_tasks WHERE project_id = ? AND completed = 0 ORDER BY position, created_at",
                SELECT_COLS
            )
        }
    } else if let Some(date) = &due_date {
        // For "today" view: tasks due on this date OR overdue (due before this date)
        if include_completed {
            format!(
                "SELECT {} FROM local_tasks WHERE due_date IS NOT NULL AND due_date <= ? ORDER BY due_date, priority DESC, position",
                SELECT_COLS
            )
        } else {
            format!(
                "SELECT {} FROM local_tasks WHERE due_date IS NOT NULL AND due_date <= ? AND completed = 0 ORDER BY due_date, priority DESC, position",
                SELECT_COLS
            )
        }
    } else {
        if include_completed {
            format!(
                "SELECT {} FROM local_tasks ORDER BY project_id, completed, position, created_at",
                SELECT_COLS
            )
        } else {
            format!(
                "SELECT {} FROM local_tasks WHERE completed = 0 ORDER BY project_id, position, created_at",
                SELECT_COLS
            )
        }
    };

    let bind_val = project_id.or(due_date);

    let rows: Vec<(
        String,
        Option<String>,
        String,
        Option<String>,
        String,
        i64,
        Option<String>,
        i64,
        Option<String>,
        i64,
        String,
        String,
    )> = if let Some(val) = &bind_val {
        sqlx::query_as(&query)
            .bind(val)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(&query)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?
    };

    Ok(rows.into_iter().map(row_to_task).collect())
}

#[tauri::command]
pub async fn create_local_task(
    app: AppHandle,
    content: String,
    project_id: Option<String>,
    parent_id: Option<String>,
    description: Option<String>,
    priority: Option<i64>,
    due_date: Option<String>,
) -> Result<LocalTask, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let project_id = project_id.unwrap_or_else(|| "inbox".to_string());
    let priority = priority.unwrap_or(1);

    // Get next position within the parent/project scope
    let max_pos: i64 = if let Some(ref pid) = parent_id {
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM local_tasks WHERE parent_id = ?")
            .bind(pid)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?
    } else {
        sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) FROM local_tasks WHERE project_id = ? AND parent_id IS NULL",
        )
        .bind(&project_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    sqlx::query(
        "INSERT INTO local_tasks (id, parent_id, content, description, project_id, priority, due_date, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&parent_id)
    .bind(&content)
    .bind(&description)
    .bind(&project_id)
    .bind(priority)
    .bind(&due_date)
    .bind(max_pos + 1)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Fetch and return the created task
    let row: (
        String,
        Option<String>,
        String,
        Option<String>,
        String,
        i64,
        Option<String>,
        i64,
        Option<String>,
        i64,
        String,
        String,
    ) = sqlx::query_as(&format!("SELECT {} FROM local_tasks WHERE id = ?", SELECT_COLS))
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(row_to_task(row))
}

#[tauri::command]
pub async fn update_local_task(
    app: AppHandle,
    id: String,
    content: Option<String>,
    description: Option<String>,
    project_id: Option<String>,
    priority: Option<i64>,
    due_date: Option<String>,
    clear_due_date: Option<bool>,
) -> Result<LocalTask, String> {
    let pool = app.state::<SqlitePool>();

    if let Some(content) = &content {
        sqlx::query("UPDATE local_tasks SET content = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(content)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(desc) = &description {
        sqlx::query("UPDATE local_tasks SET description = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(desc)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(pid) = &project_id {
        sqlx::query("UPDATE local_tasks SET project_id = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(pid)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(pri) = priority {
        sqlx::query("UPDATE local_tasks SET priority = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(pri)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(date) = &due_date {
        sqlx::query("UPDATE local_tasks SET due_date = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(date)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if clear_due_date.unwrap_or(false) {
        sqlx::query("UPDATE local_tasks SET due_date = NULL, updated_at = datetime('now') WHERE id = ?")
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    let row: (
        String,
        Option<String>,
        String,
        Option<String>,
        String,
        i64,
        Option<String>,
        i64,
        Option<String>,
        i64,
        String,
        String,
    ) = sqlx::query_as(&format!("SELECT {} FROM local_tasks WHERE id = ?", SELECT_COLS))
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(row_to_task(row))
}

#[tauri::command]
pub async fn complete_local_task(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    sqlx::query(
        "UPDATE local_tasks SET completed = 1, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Also complete all subtasks
    sqlx::query(
        "UPDATE local_tasks SET completed = 1, completed_at = datetime('now'), updated_at = datetime('now') WHERE parent_id = ?",
    )
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn uncomplete_local_task(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    sqlx::query(
        "UPDATE local_tasks SET completed = 0, completed_at = NULL, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_local_task(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    // Delete subtasks first (CASCADE should handle this, but be explicit)
    sqlx::query("DELETE FROM local_tasks WHERE parent_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM local_tasks WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
