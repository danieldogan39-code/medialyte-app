// Medialyte als Programm für Mac und Windows: dieselbe App wie im Browser, mit eigenem Fenster.
// Links nach außen (Demos, WhatsApp, E-Mail, Telefon) öffnen im Standardprogramm des Rechners.
// Updates: signierte neue Versionen kommen über den Tauri-Updater (Kanal: Release „aktualisierung“) und werden
// erst beim nächsten Start aktiv – nie mitten in der Arbeit.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("Medialyte konnte nicht gestartet werden");
}
