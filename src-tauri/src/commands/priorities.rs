use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Priority {
    pub title: String,
    pub source: String,
    pub reasoning: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyStateResponse {
    pub date: String,
    pub energy_level: Option<String>,
    pub priorities: Option<Vec<Priority>>,
    pub review_complete: bool,
}

/// Check if today's daily review has been completed
#[tauri::command]
pub async fn get_daily_state(app: AppHandle) -> Result<DailyStateResponse, String> {
    let pool = app.state::<SqlitePool>();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let row: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT date, energy_level, top_priorities FROM daily_state WHERE date = ?",
    )
    .bind(&today)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some((date, energy, priorities_json)) => {
            let priorities: Option<Vec<Priority>> = priorities_json
                .and_then(|json| serde_json::from_str(&json).ok());
            let review_complete = energy.is_some() && priorities.is_some();
            Ok(DailyStateResponse {
                date,
                energy_level: energy,
                priorities,
                review_complete,
            })
        }
        None => Ok(DailyStateResponse {
            date: today,
            energy_level: None,
            priorities: None,
            review_complete: false,
        }),
    }
}

/// Generate top 3 priorities using Claude API
#[tauri::command]
pub async fn generate_priorities(
    app: AppHandle,
    energy_level: String,
    calendar_summary: String,
    tasks_summary: String,
    obsidian_summary: String,
) -> Result<Vec<Priority>, String> {
    let pool = app.state::<SqlitePool>();

    // Get API key
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'anthropic_api_key'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    let api_key = row
        .map(|r| r.0)
        .ok_or_else(|| "Anthropic API key not configured".to_string())?;

    let prompt = format!(
        r#"You are a personal daily coach for someone with ADHD. Based on today's data, pick the TOP 3 priorities they should focus on. Be warm but direct.

Energy level: {energy_level}
- High energy → recommend creative or hard thinking work
- Medium energy → recommend meetings, reviews, collaborative work
- Low energy → recommend mechanical tasks, admin, easy wins

TODAY'S CALENDAR:
{calendar_summary}

TODAY'S TASKS (from Todoist):
{tasks_summary}

TODAY'S OBSIDIAN (personal tasks & habits):
{obsidian_summary}

Return EXACTLY 3 priorities as a JSON array. Each item must have:
- "title": the specific action (keep it short, under 10 words)
- "source": where it came from ("Calendar", "Todoist", "Obsidian", or "General")
- "reasoning": one sentence explaining why this is a priority right now (be specific, not generic)

Respond with ONLY the JSON array, no other text."#
    );

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 500,
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

    // Parse the JSON array from Claude's response
    // Strip any markdown code fences if present
    let clean = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let priorities: Vec<Priority> =
        serde_json::from_str(clean).map_err(|e| format!("Failed to parse priorities JSON: {}. Raw: {}", e, clean))?;

    // Cache in daily_state
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let priorities_json = serde_json::to_string(&priorities).unwrap_or_default();

    sqlx::query(
        "INSERT INTO daily_state (date, energy_level, top_priorities, first_opened_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET energy_level = excluded.energy_level, top_priorities = excluded.top_priorities",
    )
    .bind(&today)
    .bind(&energy_level)
    .bind(&priorities_json)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "priorities_generated",
        None,
        Some(serde_json::json!({
            "energy_level": &energy_level,
            "count": priorities.len(),
        })),
    )
    .await;

    Ok(priorities)
}
