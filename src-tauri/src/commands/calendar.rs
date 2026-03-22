use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use crate::parsers::ical::{self, CalendarEvent};

/// Get the iCal feed URL from settings
async fn get_ical_url(app: &AppHandle) -> Result<String, String> {
    let pool = app.state::<SqlitePool>();
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'ical_feed_url'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    row.map(|r| r.0)
        .ok_or_else(|| "iCal feed URL not configured".to_string())
}

/// Fetch calendar events from iCal feed, filter to today, cache in SQLite
#[tauri::command]
pub async fn fetch_calendar_events(app: AppHandle) -> Result<Vec<CalendarEvent>, String> {
    let ical_url = get_ical_url(&app).await?;
    let pool = app.state::<SqlitePool>();

    // Fetch iCal feed
    let client = reqwest::Client::new();
    let ical_content = client
        .get(&ical_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch calendar: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read calendar response: {}", e))?;

    // Parse for today's events
    let events = ical::parse_ical_for_today(&ical_content);

    // Clear old cache and insert fresh
    sqlx::query("DELETE FROM calendar_events")
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    for event in &events {
        sqlx::query(
            "INSERT OR REPLACE INTO calendar_events
             (id, summary, description, location, start_time, end_time, all_day, meeting_url, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        )
        .bind(&event.id)
        .bind(&event.summary)
        .bind(&event.description)
        .bind(&event.location)
        .bind(&event.start_time)
        .bind(&event.end_time)
        .bind(event.all_day)
        .bind(&event.meeting_url)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(events)
}
