use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

pub use daily_triage_core::types::TodoistTaskRow;

/// Get the API token from settings
async fn get_api_token(app: &AppHandle) -> Result<String, String> {
    let pool = app.state::<SqlitePool>();
    daily_triage_core::db::settings::get_setting(pool.inner(), "todoist_api_token")
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Todoist API token not configured".to_string())
}

#[tauri::command]
pub async fn fetch_todoist_tasks(app: AppHandle) -> Result<Vec<TodoistTaskRow>, String> {
    let pool = app.state::<SqlitePool>();
    let token = get_api_token(&app).await?;
    daily_triage_core::api::todoist::fetch_todoist_tasks(pool.inner(), &token)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn refresh_todoist_tasks(app: AppHandle) -> Result<Vec<TodoistTaskRow>, String> {
    let pool = app.state::<SqlitePool>();
    let token = get_api_token(&app).await?;
    daily_triage_core::api::todoist::refresh_todoist_tasks(pool.inner(), &token)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn complete_todoist_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let token = get_api_token(&app).await?;
    daily_triage_core::api::todoist::complete_todoist_task(pool.inner(), &token, &task_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn snooze_todoist_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let token = get_api_token(&app).await?;
    daily_triage_core::api::todoist::snooze_todoist_task(pool.inner(), &token, &task_id)
        .await
        .map_err(|e| e.to_string())
}
