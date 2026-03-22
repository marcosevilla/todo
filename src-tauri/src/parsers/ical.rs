use chrono::{Local, NaiveDate, NaiveDateTime};
use ical::parser::ical::component::IcalCalendar;
use ical::IcalParser;
use serde::{Deserialize, Serialize};
use std::io::BufReader;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub all_day: bool,
    pub meeting_url: Option<String>,
}

/// Parse an iCal feed string into calendar events for today
pub fn parse_ical_for_today(ical_content: &str) -> Vec<CalendarEvent> {
    let today = Local::now().date_naive();
    let reader = BufReader::new(ical_content.as_bytes());
    let parser = IcalParser::new(reader);

    let mut events = Vec::new();

    for calendar_result in parser {
        let calendar: IcalCalendar = match calendar_result {
            Ok(c) => c,
            Err(_) => continue,
        };

        for event in calendar.events {
            let mut uid = String::new();
            let mut summary = String::new();
            let mut description: Option<String> = None;
            let mut location: Option<String> = None;
            let mut dtstart: Option<String> = None;
            let mut dtend: Option<String> = None;

            for prop in &event.properties {
                match prop.name.as_str() {
                    "UID" => uid = prop.value.clone().unwrap_or_default(),
                    "SUMMARY" => summary = prop.value.clone().unwrap_or_default(),
                    "DESCRIPTION" => description = prop.value.clone(),
                    "LOCATION" => location = prop.value.clone(),
                    "DTSTART" => dtstart = prop.value.clone(),
                    "DTEND" => dtend = prop.value.clone(),
                    _ => {}
                }
            }

            let Some(start_raw) = dtstart else { continue };
            let end_raw = dtend.unwrap_or_else(|| start_raw.clone());

            // Determine if this is an all-day event (date only, no time component)
            let all_day = start_raw.len() <= 10 || !start_raw.contains('T');

            // Check if event is today
            let is_today = if all_day {
                // All-day: compare date part
                parse_ical_date(&start_raw)
                    .map(|d| d == today)
                    .unwrap_or(false)
            } else {
                // Timed: check if the event's date matches today
                parse_ical_datetime(&start_raw)
                    .map(|dt| dt.date() == today)
                    .unwrap_or(false)
            };

            if !is_today {
                continue;
            }

            // Format times for display
            let (start_time, end_time) = if all_day {
                (start_raw.clone(), end_raw.clone())
            } else {
                let start_fmt = parse_ical_datetime(&start_raw)
                    .map(|dt| dt.format("%H:%M").to_string())
                    .unwrap_or(start_raw.clone());
                let end_fmt = parse_ical_datetime(&end_raw)
                    .map(|dt| dt.format("%H:%M").to_string())
                    .unwrap_or(end_raw.clone());
                (start_fmt, end_fmt)
            };

            // Extract meeting URL from description or location
            let meeting_url = extract_meeting_url(
                description.as_deref().unwrap_or(""),
                location.as_deref().unwrap_or(""),
            );

            events.push(CalendarEvent {
                id: uid,
                summary,
                description,
                location,
                start_time,
                end_time,
                all_day,
                meeting_url,
            });
        }
    }

    // Sort by start time
    events.sort_by(|a, b| a.start_time.cmp(&b.start_time));
    events
}

/// Parse iCal date format: 20260322 or 2026-03-22
fn parse_ical_date(s: &str) -> Option<NaiveDate> {
    let clean = s.trim();
    NaiveDate::parse_from_str(clean, "%Y%m%d")
        .or_else(|_| NaiveDate::parse_from_str(clean, "%Y-%m-%d"))
        .ok()
}

/// Parse iCal datetime format: 20260322T140000Z or 20260322T140000
fn parse_ical_datetime(s: &str) -> Option<NaiveDateTime> {
    let clean = s.trim().trim_end_matches('Z');
    NaiveDateTime::parse_from_str(clean, "%Y%m%dT%H%M%S")
        .or_else(|_| NaiveDateTime::parse_from_str(clean, "%Y-%m-%dT%H:%M:%S"))
        .ok()
}

/// Extract Zoom/Meet/Teams URLs from description and location
fn extract_meeting_url(description: &str, location: &str) -> Option<String> {
    let combined = format!("{} {}", description, location);

    // Common meeting URL patterns
    let patterns = [
        "https://meet.google.com/",
        "https://zoom.us/j/",
        "https://us02web.zoom.us/",
        "https://us04web.zoom.us/",
        "https://us05web.zoom.us/",
        "https://us06web.zoom.us/",
        "https://teams.microsoft.com/l/meetup-join/",
    ];

    for pattern in &patterns {
        if let Some(start) = combined.find(pattern) {
            let url_slice = &combined[start..];
            // Extract until whitespace or end
            let end = url_slice
                .find(|c: char| c.is_whitespace() || c == '"' || c == '<' || c == '>')
                .unwrap_or(url_slice.len());
            return Some(url_slice[..end].to_string());
        }
    }

    None
}
