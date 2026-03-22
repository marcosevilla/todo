use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use crate::parsers::markdown::{self, ParsedTodayMd};

/// Resolve the vault path from settings, expanding ~
async fn get_vault_path(app: &AppHandle) -> Result<String, String> {
    let pool = app.state::<SqlitePool>();

    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'obsidian_vault_path'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    let path = row
        .map(|r| r.0)
        .ok_or_else(|| "Obsidian vault path not configured".to_string())?;

    // Expand ~ to home dir
    if path.starts_with('~') {
        let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
        Ok(path.replacen('~', &home.to_string_lossy(), 1))
    } else {
        Ok(path)
    }
}

/// Read and parse today.md from the vault
#[tauri::command]
pub async fn read_today_md(app: AppHandle) -> Result<ParsedTodayMd, String> {
    let vault_path = get_vault_path(&app).await?;
    let file_path = format!("{}/today.md", vault_path);

    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read today.md: {}", e))?;

    Ok(markdown::parse_today_md(&content))
}

/// Toggle a checkbox in a vault file at a specific line
#[tauri::command]
pub async fn toggle_obsidian_checkbox(
    app: AppHandle,
    file_name: String,
    line_number: usize,
) -> Result<ParsedTodayMd, String> {
    let vault_path = get_vault_path(&app).await?;
    let file_path = format!("{}/{}", vault_path, file_name);

    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", file_name, e))?;

    let new_content = markdown::toggle_checkbox(&content, line_number);

    tokio::fs::write(&file_path, &new_content)
        .await
        .map_err(|e| format!("Failed to write {}: {}", file_name, e))?;

    // Return the updated parsed state
    Ok(markdown::parse_today_md(&new_content))
}
