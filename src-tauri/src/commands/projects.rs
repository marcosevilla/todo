use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
    pub position: i64,
}

#[tauri::command]
pub async fn get_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    let pool = app.state::<SqlitePool>();
    let rows: Vec<(String, String, String, i64)> = sqlx::query_as(
        "SELECT id, name, color, position FROM projects ORDER BY position, created_at",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|(id, name, color, position)| Project {
            id,
            name,
            color,
            position,
        })
        .collect())
}

#[tauri::command]
pub async fn create_project(
    app: AppHandle,
    name: String,
    color: String,
) -> Result<Project, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();

    // Get next position
    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM projects")
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO projects (id, name, color, position) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&color)
        .bind(max_pos + 1)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name,
        color,
        position: max_pos + 1,
    })
}

#[tauri::command]
pub async fn update_project(
    app: AppHandle,
    id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    if let Some(name) = name {
        sqlx::query("UPDATE projects SET name = ? WHERE id = ?")
            .bind(&name)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(color) = color {
        sqlx::query("UPDATE projects SET color = ? WHERE id = ?")
            .bind(&color)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    if id == "inbox" {
        return Err("Cannot delete the Inbox project".to_string());
    }
    let pool = app.state::<SqlitePool>();

    // Move tasks to Inbox before deleting
    sqlx::query("UPDATE local_tasks SET project_id = 'inbox' WHERE project_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
