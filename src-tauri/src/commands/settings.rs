use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct SettingRow {
    pub key: String,
    pub value: String,
}

/// Required settings keys for the app to function
const REQUIRED_SETTINGS: &[&str] = &[
    "todoist_api_token",
    "ical_feed_url",
    "obsidian_vault_path",
    "anthropic_api_key",
];

/// Check if all required settings are configured
#[tauri::command]
pub async fn check_setup_complete(app: AppHandle) -> Result<bool, String> {
    let pool = app.state::<SqlitePool>();

    for key in REQUIRED_SETTINGS {
        let row: Option<SettingRow> = sqlx::query_as(
            "SELECT key, value FROM settings WHERE key = ? AND value != ''",
        )
        .bind(key)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        if row.is_none() {
            return Ok(false);
        }
    }
    Ok(true)
}

/// Get a single setting by key
#[tauri::command]
pub async fn get_setting(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let pool = app.state::<SqlitePool>();

    let row: Option<SettingRow> =
        sqlx::query_as("SELECT key, value FROM settings WHERE key = ?")
            .bind(&key)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    Ok(row.map(|r| r.value))
}

/// Set a setting (upsert)
#[tauri::command]
pub async fn set_setting(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    )
    .bind(&key)
    .bind(&value)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get all settings as a list
#[tauri::command]
pub async fn get_all_settings(app: AppHandle) -> Result<Vec<SettingRow>, String> {
    let pool = app.state::<SqlitePool>();

    let rows: Vec<SettingRow> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows)
}
