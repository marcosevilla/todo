use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveResult {
    pub snapshot_id: i64,
    pub session_log_path: String,
}

/// Save progress: snapshot to SQLite + append session entry to Obsidian vault
#[tauri::command]
pub async fn save_progress(
    app: AppHandle,
    energy_level: String,
    tasks_completed: String,
    tasks_open: String,
    tasks_deferred: String,
    priorities: String,
) -> Result<SaveResult, String> {
    let pool = app.state::<SqlitePool>();
    let now = Local::now();

    // 1. Save snapshot to SQLite
    let result = sqlx::query(
        "INSERT INTO progress_snapshots (energy_level, tasks_completed, tasks_open, tasks_deferred, priorities, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&energy_level)
    .bind(&tasks_completed)
    .bind(&tasks_open)
    .bind(&tasks_deferred)
    .bind(&priorities)
    .bind(now.format("%Y-%m-%d %H:%M:%S").to_string())
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let snapshot_id = result.last_insert_rowid();

    // 2. Update daily_state
    let today = now.format("%Y-%m-%d").to_string();
    sqlx::query(
        "INSERT INTO daily_state (date, energy_level, last_saved_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET last_saved_at = datetime('now'), energy_level = excluded.energy_level",
    )
    .bind(&today)
    .bind(&energy_level)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // 3. Write session log to Obsidian vault
    let vault_path = get_vault_path(&app).await?;
    let session_file = format!(
        "{}/journal/sessions/Session {}.md",
        vault_path,
        now.format("%Y-%m-%d")
    );

    // Ensure sessions directory exists
    let sessions_dir = format!("{}/journal/sessions", vault_path);
    tokio::fs::create_dir_all(&sessions_dir)
        .await
        .map_err(|e| format!("Failed to create sessions dir: {}", e))?;

    // Build session entry
    let time_str = now.format("%-I:%M %p").to_string();
    let completed_list: Vec<String> = serde_json::from_str(&tasks_completed).unwrap_or_default();
    let open_list: Vec<String> = serde_json::from_str(&tasks_open).unwrap_or_default();

    let mut entry = String::new();

    // If file doesn't exist, write frontmatter + header
    let file_exists = tokio::fs::metadata(&session_file).await.is_ok();
    if !file_exists {
        entry.push_str(&format!(
            "---\ntype: session_log\ndate: {}\ngenerated: true\n---\n\n# Sessions — {}\n",
            now.format("%Y-%m-%d"),
            now.format("%A, %B %-d")
        ));
    }

    // Append entry
    entry.push_str(&format!("\n---\n\n## {} — Daily Triage\n\n", time_str));
    entry.push_str("`#triage`\n\n");

    if !completed_list.is_empty() {
        entry.push_str("**Completed:**\n");
        for item in &completed_list {
            entry.push_str(&format!("- {}\n", item));
        }
        entry.push('\n');
    }

    if !open_list.is_empty() {
        entry.push_str("**Still open:**\n");
        for item in &open_list {
            entry.push_str(&format!("- {}\n", item));
        }
        entry.push('\n');
    }

    entry.push_str(&format!(
        "> [!energy] Energy: {}\n> Logged from Daily Triage app\n",
        energy_level
    ));

    // Append to file
    let mut existing = if file_exists {
        tokio::fs::read_to_string(&session_file)
            .await
            .unwrap_or_default()
    } else {
        String::new()
    };
    existing.push_str(&entry);

    tokio::fs::write(&session_file, &existing)
        .await
        .map_err(|e| format!("Failed to write session log: {}", e))?;

    Ok(SaveResult {
        snapshot_id,
        session_log_path: session_file,
    })
}

/// Resolve vault path from settings
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
    if path.starts_with('~') {
        let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
        Ok(path.replacen('~', &home.to_string_lossy(), 1))
    } else {
        Ok(path)
    }
}
