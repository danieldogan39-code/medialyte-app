// Medialyte als Programm für Mac und Windows: dieselbe App wie im Browser, mit eigenem Fenster.
// Links nach außen (Demos, WhatsApp, E-Mail, Telefon) öffnen im Standardprogramm des Rechners.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("Medialyte konnte nicht gestartet werden");
}
