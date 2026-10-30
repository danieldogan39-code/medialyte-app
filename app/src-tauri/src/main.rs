// Kein Konsolenfenster unter Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    medialyte_lib::run()
}
