use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// --- Structs ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LifeArea {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub position: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Goal {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub life_area_id: Option<String>,
    pub start_date: Option<String>,
    pub target_date: Option<String>,
    pub color: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoalWithProgress {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub life_area_id: Option<String>,
    pub start_date: Option<String>,
    pub target_date: Option<String>,
    pub color: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub progress: f64,
    pub milestone_count: i64,
    pub milestone_completed: i64,
    pub task_count: i64,
    pub task_completed: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Milestone {
    pub id: String,
    pub goal_id: String,
    pub name: String,
    pub target_date: Option<String>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub position: i64,
    pub created_at: String,
}

// --- Helper conversions ---

fn row_to_goal(
    row: (
        String,
        String,
        Option<String>,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        i64,
        String,
        String,
    ),
) -> Goal {
    Goal {
        id: row.0,
        name: row.1,
        description: row.2,
        status: row.3,
        life_area_id: row.4,
        start_date: row.5,
        target_date: row.6,
        color: row.7,
        position: row.8,
        created_at: row.9,
        updated_at: row.10,
    }
}

fn row_to_milestone(
    row: (
        String,
        String,
        String,
        Option<String>,
        i64,
        Option<String>,
        i64,
        String,
    ),
) -> Milestone {
    Milestone {
        id: row.0,
        goal_id: row.1,
        name: row.2,
        target_date: row.3,
        completed: row.4 != 0,
        completed_at: row.5,
        position: row.6,
        created_at: row.7,
    }
}

const GOAL_SELECT: &str = "id, name, description, status, life_area_id, start_date, target_date, color, position, created_at, updated_at";

async fn compute_progress(pool: &SqlitePool, goal_id: &str) -> (f64, i64, i64, i64, i64) {
    // Milestone counts
    let milestone_row: (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*) as total, COALESCE(SUM(completed), 0) as done FROM milestones WHERE goal_id = ?",
    )
    .bind(goal_id)
    .fetch_one(pool)
    .await
    .unwrap_or((0, 0));

    let milestone_count = milestone_row.0;
    let milestone_completed = milestone_row.1;

    // Task counts from linked projects
    let task_row: (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as done FROM local_tasks WHERE project_id IN (SELECT id FROM projects WHERE goal_id = ?)",
    )
    .bind(goal_id)
    .fetch_one(pool)
    .await
    .unwrap_or((0, 0));

    let task_count = task_row.0;
    let task_completed = task_row.1;

    let progress = if milestone_count > 0 {
        milestone_completed as f64 / milestone_count as f64
    } else if task_count > 0 {
        task_completed as f64 / task_count as f64
    } else {
        0.0
    };

    (progress, milestone_count, milestone_completed, task_count, task_completed)
}

fn goal_with_progress(goal: Goal, progress: f64, mc: i64, md: i64, tc: i64, td: i64) -> GoalWithProgress {
    GoalWithProgress {
        id: goal.id,
        name: goal.name,
        description: goal.description,
        status: goal.status,
        life_area_id: goal.life_area_id,
        start_date: goal.start_date,
        target_date: goal.target_date,
        color: goal.color,
        position: goal.position,
        created_at: goal.created_at,
        updated_at: goal.updated_at,
        progress,
        milestone_count: mc,
        milestone_completed: md,
        task_count: tc,
        task_completed: td,
    }
}

// --- Goal Commands ---

#[tauri::command]
pub async fn get_goals(app: AppHandle) -> Result<Vec<GoalWithProgress>, String> {
    let pool = app.state::<SqlitePool>();

    let rows: Vec<(
        String,
        String,
        Option<String>,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        i64,
        String,
        String,
    )> = sqlx::query_as(&format!(
        "SELECT {} FROM goals ORDER BY position, created_at",
        GOAL_SELECT
    ))
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        let goal = row_to_goal(row);
        let (progress, mc, md, tc, td) = compute_progress(pool.inner(), &goal.id).await;
        results.push(goal_with_progress(goal, progress, mc, md, tc, td));
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_goal(app: AppHandle, id: String) -> Result<GoalWithProgress, String> {
    let pool = app.state::<SqlitePool>();

    let row: (
        String,
        String,
        Option<String>,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        i64,
        String,
        String,
    ) = sqlx::query_as(&format!(
        "SELECT {} FROM goals WHERE id = ?",
        GOAL_SELECT
    ))
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let goal = row_to_goal(row);
    let (progress, mc, md, tc, td) = compute_progress(pool.inner(), &goal.id).await;

    Ok(goal_with_progress(goal, progress, mc, md, tc, td))
}

#[tauri::command]
pub async fn create_goal(
    app: AppHandle,
    name: String,
    description: Option<String>,
    status: Option<String>,
    life_area_id: Option<String>,
    start_date: Option<String>,
    target_date: Option<String>,
    color: Option<String>,
) -> Result<Goal, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let status = status.unwrap_or_else(|| "active".to_string());

    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM goals")
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO goals (id, name, description, status, life_area_id, start_date, target_date, color, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&description)
    .bind(&status)
    .bind(&life_area_id)
    .bind(&start_date)
    .bind(&target_date)
    .bind(&color)
    .bind(max_pos + 1)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "goal_created",
        Some(&id),
        Some(serde_json::json!({ "name": &name })),
    )
    .await;

    Ok(Goal {
        id,
        name,
        description,
        status,
        life_area_id,
        start_date,
        target_date,
        color,
        position: max_pos + 1,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub async fn update_goal(
    app: AppHandle,
    id: String,
    name: Option<String>,
    description: Option<String>,
    status: Option<String>,
    life_area_id: Option<String>,
    start_date: Option<String>,
    target_date: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    if let Some(ref val) = name {
        sqlx::query("UPDATE goals SET name = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = description {
        sqlx::query("UPDATE goals SET description = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = status {
        sqlx::query("UPDATE goals SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = life_area_id {
        sqlx::query("UPDATE goals SET life_area_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = start_date {
        sqlx::query("UPDATE goals SET start_date = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = target_date {
        sqlx::query("UPDATE goals SET target_date = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = color {
        sqlx::query("UPDATE goals SET color = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut fields_changed = Vec::new();
    if name.is_some() { fields_changed.push("name"); }
    if description.is_some() { fields_changed.push("description"); }
    if status.is_some() { fields_changed.push("status"); }
    if life_area_id.is_some() { fields_changed.push("life_area_id"); }
    if start_date.is_some() { fields_changed.push("start_date"); }
    if target_date.is_some() { fields_changed.push("target_date"); }
    if color.is_some() { fields_changed.push("color"); }

    if !fields_changed.is_empty() {
        crate::db::activity::log_activity(
            pool.inner(),
            "goal_updated",
            Some(&id),
            Some(serde_json::json!({ "fields_changed": fields_changed })),
        )
        .await;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_goal(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    // Delete milestones first (CASCADE should handle this but be explicit)
    sqlx::query("DELETE FROM milestones WHERE goal_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Unlink projects
    sqlx::query("UPDATE projects SET goal_id = NULL, milestone_id = NULL WHERE goal_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM goals WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "goal_deleted",
        Some(&id),
        None,
    )
    .await;

    Ok(())
}

// --- Milestone Commands ---

#[tauri::command]
pub async fn get_milestones(app: AppHandle, goal_id: String) -> Result<Vec<Milestone>, String> {
    let pool = app.state::<SqlitePool>();

    let rows: Vec<(
        String,
        String,
        String,
        Option<String>,
        i64,
        Option<String>,
        i64,
        String,
    )> = sqlx::query_as(
        "SELECT id, goal_id, name, target_date, completed, completed_at, position, created_at FROM milestones WHERE goal_id = ? ORDER BY position, created_at",
    )
    .bind(&goal_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(row_to_milestone).collect())
}

#[tauri::command]
pub async fn create_milestone(
    app: AppHandle,
    goal_id: String,
    name: String,
    target_date: Option<String>,
) -> Result<Milestone, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();

    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM milestones WHERE goal_id = ?")
            .bind(&goal_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO milestones (id, goal_id, name, target_date, position) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&goal_id)
    .bind(&name)
    .bind(&target_date)
    .bind(max_pos + 1)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "milestone_created",
        Some(&id),
        Some(serde_json::json!({ "goal_id": &goal_id, "name": &name })),
    )
    .await;

    Ok(Milestone {
        id,
        goal_id,
        name,
        target_date,
        completed: false,
        completed_at: None,
        position: max_pos + 1,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub async fn update_milestone(
    app: AppHandle,
    id: String,
    name: Option<String>,
    target_date: Option<String>,
    completed: Option<bool>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    if let Some(ref val) = name {
        sqlx::query("UPDATE milestones SET name = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = target_date {
        sqlx::query("UPDATE milestones SET target_date = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(done) = completed {
        if done {
            sqlx::query("UPDATE milestones SET completed = 1, completed_at = datetime('now', 'localtime') WHERE id = ?")
                .bind(&id)
                .execute(pool.inner())
                .await
                .map_err(|e| e.to_string())?;

            crate::db::activity::log_activity(
                pool.inner(),
                "milestone_completed",
                Some(&id),
                None,
            )
            .await;
        } else {
            sqlx::query("UPDATE milestones SET completed = 0, completed_at = NULL WHERE id = ?")
                .bind(&id)
                .execute(pool.inner())
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_milestone(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    // Unlink any projects referencing this milestone
    sqlx::query("UPDATE projects SET milestone_id = NULL WHERE milestone_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM milestones WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "milestone_deleted",
        Some(&id),
        None,
    )
    .await;

    Ok(())
}

// --- Life Area Commands ---

#[tauri::command]
pub async fn get_life_areas(app: AppHandle) -> Result<Vec<LifeArea>, String> {
    let pool = app.state::<SqlitePool>();

    let rows: Vec<(String, String, String, String, i64, String)> = sqlx::query_as(
        "SELECT id, name, color, icon, position, created_at FROM life_areas ORDER BY position",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|(id, name, color, icon, position, created_at)| LifeArea {
            id,
            name,
            color,
            icon,
            position,
            created_at,
        })
        .collect())
}

#[tauri::command]
pub async fn create_life_area(
    app: AppHandle,
    name: String,
    color: String,
    icon: String,
) -> Result<LifeArea, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();

    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM life_areas")
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO life_areas (id, name, color, icon, position) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&color)
        .bind(&icon)
        .bind(max_pos + 1)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(LifeArea {
        id,
        name,
        color,
        icon,
        position: max_pos + 1,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub async fn update_life_area(
    app: AppHandle,
    id: String,
    name: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    if let Some(ref val) = name {
        sqlx::query("UPDATE life_areas SET name = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = color {
        sqlx::query("UPDATE life_areas SET color = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = icon {
        sqlx::query("UPDATE life_areas SET icon = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_life_area(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    // Unlink goals from this life area
    sqlx::query("UPDATE goals SET life_area_id = NULL WHERE life_area_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM life_areas WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
