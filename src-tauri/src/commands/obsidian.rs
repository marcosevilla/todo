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
