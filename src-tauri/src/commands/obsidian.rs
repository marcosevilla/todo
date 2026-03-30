use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use crate::parsers::markdown::{self, ParsedTodayMd};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickCapture {
    pub timestamp: Option<String>,
    pub content: String,
}

/// Parse Quick Captures.md — entries separated by ---
fn parse_quick_captures(content: &str) -> Vec<QuickCapture> {
    let mut captures = Vec::new();
    let mut current_lines: Vec<&str> = Vec::new();

    // Skip the header section (everything before the second ---)
    let mut header_count = 0;
    let mut in_body = false;

    for line in content.lines() {
        if line.trim() == "---" {
            if !in_body {
                header_count += 1;
                if header_count >= 2 {
                    in_body = true;
                }
                continue;
            }
            // Process accumulated lines as a capture
            if !current_lines.is_empty() {
                let entry = current_lines.join("\n").trim().to_string();
                if !entry.is_empty() {
                    let (timestamp, text) = extract_timestamp(&entry);
                    captures.push(QuickCapture {
                        timestamp,
                        content: text,
                    });
                }
            }
            current_lines.clear();
            continue;
        }
        if in_body {
            current_lines.push(line);
        }
    }

    // Handle last entry (no trailing ---)
    if !current_lines.is_empty() {
        let entry = current_lines.join("\n").trim().to_string();
        if !entry.is_empty() {
            let (timestamp, text) = extract_timestamp(&entry);
            captures.push(QuickCapture {
                timestamp,
                content: text,
            });
        }
    }

    // Most recent first, limit to 10
    captures.reverse();
    captures.truncate(10);
    captures
}

/// Try to extract a timestamp line from a capture entry
fn extract_timestamp(entry: &str) -> (Option<String>, String) {
    let lines: Vec<&str> = entry.lines().collect();
    if lines.is_empty() {
        return (None, entry.to_string());
    }

    // Check if first line looks like a timestamp (contains year and time)
    let first = lines[0].trim();
    if first.contains("202") && (first.contains("AM") || first.contains("PM")) {
        let rest = lines[1..].join("\n").trim().to_string();
        (Some(first.to_string()), if rest.is_empty() { first.to_string() } else { rest })
    } else {
        (None, entry.to_string())
    }
}

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

/// Read quick captures from the inbox file
#[tauri::command]
pub async fn read_quick_captures(app: AppHandle) -> Result<Vec<QuickCapture>, String> {
    let vault_path = get_vault_path(&app).await?;
    let file_path = format!("{}/inbox/Quick Captures.md", vault_path);

    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read Quick Captures.md: {}", e))?;

    Ok(parse_quick_captures(&content))
}

/// Read today's session log from journal/sessions/
#[tauri::command]
pub async fn read_session_log(app: AppHandle) -> Result<Option<String>, String> {
    let vault_path = get_vault_path(&app).await?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    let file_path = format!("{}/journal/sessions/Session {}.md", vault_path, today);

    match tokio::fs::read_to_string(&file_path).await {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read session log: {}", e)),
    }
}

/// Read daily brief from journal/briefs/
#[tauri::command]
pub async fn read_daily_brief(app: AppHandle, date: Option<String>) -> Result<Option<String>, String> {
    let vault_path = get_vault_path(&app).await?;
    let date = date.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());
    let file_path = format!("{}/journal/briefs/Brief {}.md", vault_path, date);

    match tokio::fs::read_to_string(&file_path).await {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read daily brief: {}", e)),
    }
}

/// List all dates that have briefs
#[tauri::command]
pub async fn list_brief_dates(app: AppHandle) -> Result<Vec<String>, String> {
    let vault_path = get_vault_path(&app).await?;
    let briefs_dir = format!("{}/journal/briefs", vault_path);

    let mut dates = Vec::new();
    let mut dir = match tokio::fs::read_dir(&briefs_dir).await {
        Ok(d) => d,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(dates),
        Err(e) => return Err(format!("Failed to read briefs directory: {}", e)),
    };

    while let Ok(Some(entry)) = dir.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        // Extract date from "Brief YYYY-MM-DD.md"
        if name.starts_with("Brief ") && name.ends_with(".md") {
            let date = name.trim_start_matches("Brief ").trim_end_matches(".md").to_string();
            if date.len() == 10 {
                dates.push(date);
            }
        }
    }

    dates.sort();
    dates.reverse(); // newest first
    Ok(dates)
}

/// Write a quick capture to Quick Captures.md
#[tauri::command]
pub async fn write_quick_capture(app: AppHandle, content: String) -> Result<QuickCapture, String> {
    let vault_path = get_vault_path(&app).await?;
    let file_path = format!("{}/inbox/Quick Captures.md", vault_path);

    // Ensure the inbox directory exists
    let inbox_dir = format!("{}/inbox", vault_path);
    tokio::fs::create_dir_all(&inbox_dir)
        .await
        .map_err(|e| format!("Failed to create inbox dir: {}", e))?;

    // Format the new entry
    let timestamp = Local::now().format("%B %d, %Y at %I:%M %p").to_string();
    let new_entry = format!("\n---\n\n{}\n{}\n", timestamp, content.trim());

    // Read existing content or create with frontmatter
    let existing = match tokio::fs::read_to_string(&file_path).await {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Create the file with frontmatter
            "---\ntags: inbox\n---\n".to_string()
        }
        Err(e) => return Err(format!("Failed to read Quick Captures.md: {}", e)),
    };

    // Append the new entry
    let updated = format!("{}{}", existing.trim_end(), new_entry);
    tokio::fs::write(&file_path, &updated)
        .await
        .map_err(|e| format!("Failed to write Quick Captures.md: {}", e))?;

    let pool = app.state::<SqlitePool>();
    crate::db::activity::log_activity(
        pool.inner(),
        "item_captured",
        None,
        Some(serde_json::json!({
            "content": content.trim(),
            "source": "quick_capture",
        })),
    )
    .await;

    Ok(QuickCapture {
        timestamp: Some(timestamp),
        content: content.trim().to_string(),
    })
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
