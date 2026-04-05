use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::activity;
use crate::types::Project;

pub async fn get_projects(pool: &SqlitePool) -> crate::Result<Vec<Project>> {
    let rows: Vec<(String, String, String, i64)> = sqlx::query_as(
        "SELECT id, name, color, position FROM projects ORDER BY position, created_at",
    )
    .fetch_all(pool)
    .await?;

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

pub async fn create_project(
    pool: &SqlitePool,
    name: &str,
    color: &str,
) -> crate::Result<Project> {
    let id = Uuid::new_v4().to_string();

    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM projects")
            .fetch_one(pool)
            .await?;

    sqlx::query("INSERT INTO projects (id, name, color, position) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(name)
        .bind(color)
        .bind(max_pos + 1)
        .execute(pool)
        .await?;

    activity::log_activity(
        pool,
        "project_created",
        Some(&id),
        Some(serde_json::json!({ "name": name })),
    )
    .await;

    Ok(Project {
        id,
        name: name.to_string(),
        color: color.to_string(),
        position: max_pos + 1,
    })
}

pub async fn update_project(
    pool: &SqlitePool,
    id: &str,
    name: Option<&str>,
    color: Option<&str>,
) -> crate::Result<()> {
    if let Some(name) = name {
        sqlx::query("UPDATE projects SET name = ? WHERE id = ?")
            .bind(name)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(color) = color {
        sqlx::query("UPDATE projects SET color = ? WHERE id = ?")
            .bind(color)
            .bind(id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

pub async fn delete_project(pool: &SqlitePool, id: &str) -> crate::Result<()> {
    if id == "inbox" {
        return Err(crate::Error::Other("Cannot delete the Inbox project".to_string()));
    }

    // Move tasks to Inbox before deleting
    sqlx::query("UPDATE local_tasks SET project_id = 'inbox' WHERE project_id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    activity::log_activity(
        pool,
        "project_deleted",
        Some(id),
        None,
    )
    .await;

    Ok(())
}
