pub use daily_triage_core::types::UpdateStatus;

#[tauri::command]
pub async fn check_for_updates() -> UpdateStatus {
    let current = env!("CARGO_PKG_VERSION");
    daily_triage_core::api::updater::check_for_updates(current).await
}
