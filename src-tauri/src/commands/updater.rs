use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct UpdateStatus {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
    pub release_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VersionInfo {
    version: String,
    url: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates() -> UpdateStatus {
    let current = env!("CARGO_PKG_VERSION").to_string();

    let client = reqwest::Client::new();
    match client
        .get("https://raw.githubusercontent.com/marcosevilla/daily-triage/main/version.json")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) => match resp.json::<VersionInfo>().await {
            Ok(info) => {
                let update_available = info.version != current;
                UpdateStatus {
                    current_version: current,
                    latest_version: Some(info.version),
                    update_available,
                    release_url: info.url,
                    error: None,
                }
            }
            Err(_) => UpdateStatus {
                current_version: current,
                latest_version: None,
                update_available: false,
                release_url: None,
                error: Some("Could not parse version info".to_string()),
            },
        },
        Err(_) => UpdateStatus {
            current_version: current,
            latest_version: None,
            update_available: false,
            release_url: None,
            error: Some("Could not check for updates — are you online?".to_string()),
        },
    }
}
