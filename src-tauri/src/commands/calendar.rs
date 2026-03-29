use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::parsers::ical::{self, CalendarEvent};

// ── Calendar Feed CRUD ──

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct CalendarFeed {
    pub id: String,
    pub label: String,
    pub url: String,
    pub color: String,
    pub enabled: i32,
}

#[tauri::command]
pub async fn get_calendar_feeds(app: AppHandle) -> Result<Vec<CalendarFeed>, String> {
    let pool = app.state::<SqlitePool>();
    let feeds: Vec<CalendarFeed> =
        sqlx::query_as("SELECT id, label, url, color, enabled FROM calendar_feeds")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    Ok(feeds)
}

#[tauri::command]
pub async fn add_calendar_feed(
    app: AppHandle,
    label: String,
    url: String,
    color: String,
) -> Result<CalendarFeed, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO calendar_feeds (id, label, url, color) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&label)
        .bind(&url)
        .bind(&color)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(CalendarFeed {
        id,
        label,
        url,
        color,
        enabled: 1,
    })
}

#[tauri::command]
pub async fn remove_calendar_feed(app: AppHandle, feed_id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    sqlx::query("DELETE FROM calendar_feeds WHERE id = ?")
        .bind(&feed_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Fetch Calendar Events (multi-feed) ──

/// Extended calendar event with feed metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEventWithFeed {
    #[serde(flatten)]
    pub event: CalendarEvent,
    pub feed_label: Option<String>,
    pub feed_color: Option<String>,
}

/// Get the iCal feed URL from settings (legacy fallback)
async fn get_ical_url(app: &AppHandle) -> Result<Option<String>, String> {
    let pool = app.state::<SqlitePool>();
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'ical_feed_url'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    Ok(row.map(|r| r.0))
}

/// Fetch a single iCal feed and return parsed events tagged with feed metadata
async fn fetch_single_feed(
    client: &reqwest::Client,
    url: &str,
    feed_label: &str,
    feed_color: &str,
) -> Vec<CalendarEventWithFeed> {
    let response = match client.get(url).send().await {
        Ok(r) => r,
        Err(e) => {
            log::error!("Failed to fetch feed '{}': {}", feed_label, e);
            return Vec::new();
        }
    };

    let ical_content = match response.text().await {
        Ok(t) => t,
        Err(e) => {
            log::error!("Failed to read feed '{}': {}", feed_label, e);
            return Vec::new();
        }
    };

    let events = ical::parse_ical_for_today(&ical_content);
    events
        .into_iter()
        .map(|event| CalendarEventWithFeed {
            event,
            feed_label: Some(feed_label.to_string()),
            feed_color: Some(feed_color.to_string()),
        })
        .collect()
}

/// Fetch calendar events from all enabled feeds, filter to today, cache in SQLite
#[tauri::command]
pub async fn fetch_calendar_events(
    app: AppHandle,
) -> Result<Vec<CalendarEventWithFeed>, String> {
    let pool = app.state::<SqlitePool>();
    let client = reqwest::Client::new();

    // 1. Get enabled feeds from calendar_feeds table
    let feeds: Vec<CalendarFeed> =
        sqlx::query_as("SELECT id, label, url, color, enabled FROM calendar_feeds WHERE enabled = 1")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    // 2. Build list of (url, label, color) — fall back to legacy setting if no feeds
    let feed_sources: Vec<(String, String, String)> = if feeds.is_empty() {
        match get_ical_url(&app).await? {
            Some(url) => vec![(url, "Calendar".to_string(), "#6366f1".to_string())],
            None => return Err("No calendar feeds configured".to_string()),
        }
    } else {
        feeds
            .iter()
            .map(|f| (f.url.clone(), f.label.clone(), f.color.clone()))
            .collect()
    };

    // 3. Fetch all feeds concurrently
    let futures: Vec<_> = feed_sources
        .iter()
        .map(|(url, label, color)| fetch_single_feed(&client, url, label, color))
        .collect();

    let results = futures::future::join_all(futures).await;

    // 4. Aggregate and sort
    let mut all_events: Vec<CalendarEventWithFeed> =
        results.into_iter().flatten().collect();
    all_events.sort_by(|a, b| a.event.start_time.cmp(&b.event.start_time));

    // 5. Cache in SQLite (clear old, insert fresh)
    sqlx::query("DELETE FROM calendar_events")
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    for item in &all_events {
        sqlx::query(
            "INSERT OR REPLACE INTO calendar_events
             (id, summary, description, location, start_time, end_time, all_day, meeting_url, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        )
        .bind(&item.event.id)
        .bind(&item.event.summary)
        .bind(&item.event.description)
        .bind(&item.event.location)
        .bind(&item.event.start_time)
        .bind(&item.event.end_time)
        .bind(item.event.all_day)
        .bind(&item.event.meeting_url)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(all_events)
}
