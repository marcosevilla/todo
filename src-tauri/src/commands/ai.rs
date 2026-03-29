use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: Option<String>,
}

/// Break a task into digestible subtasks using Claude
#[tauri::command]
pub async fn break_down_task(
    app: AppHandle,
    task_content: String,
    task_description: Option<String>,
) -> Result<Vec<String>, String> {
    let pool = app.state::<SqlitePool>();

    // Get API key
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'anthropic_api_key'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    let api_key = row
        .map(|r| r.0)
        .ok_or_else(|| "Anthropic API key not configured. Add it in Settings.".to_string())?;

    let context = if let Some(desc) = &task_description {
        format!("Task: {}\nDescription: {}", task_content, desc)
    } else {
        format!("Task: {}", task_content)
    };

    let prompt = format!(
        r#"Break this task into 3-7 small, actionable subtasks. Each subtask should be a single concrete action that can be completed in one sitting. Keep them short (under 10 words each).

{}

Return ONLY a JSON array of strings. No other text. Example: ["Step one", "Step two", "Step three"]"#,
        context
    );

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 300,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("Claude API request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Claude API returned {}: {}", status, body));
    }

    let claude_resp: ClaudeResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    let text = claude_resp
        .content
        .first()
        .and_then(|c| c.text.clone())
        .ok_or_else(|| "Empty response from Claude".to_string())?;

    let clean = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let subtasks: Vec<String> =
        serde_json::from_str(clean).map_err(|e| format!("Failed to parse subtasks: {}. Raw: {}", e, clean))?;

    // Log activity
    crate::db::activity::log_activity(
        pool.inner(),
        "task_breakdown_requested",
        None,
        Some(serde_json::json!({
            "task_content": &task_content,
            "subtask_count": subtasks.len(),
        })),
    )
    .await;

    Ok(subtasks)
}
