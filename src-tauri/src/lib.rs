use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

/// Menampilkan window `main` kembali (dipanggil dari menu tray "Buka App"
/// maupun klik kiri ikon tray) — bekerja baik saat `main` cuma di-hide (baca
/// in-app) maupun kalau suatu saat di-minimize biasa.
fn restore_main_window(app: &tauri::AppHandle) {
  if let Some(main) = app.get_webview_window("main") {
    let _ = main.show();
    let _ = main.set_focus();
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Tray selalu ada selama app jalan (bukan dibuat/dihapus per sesi baca)
      // — dipakai sebagai jaring pengaman memunculkan window `main` lagi
      // setelah di-hide saat "Lanjutkan Membaca" (lihat floatingReader.ts).
      let show_item = MenuItem::with_id(app, "show", "Buka App", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

      TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "show" => restore_main_window(app),
          "quit" => app.exit(0),
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
            restore_main_window(tray.app_handle());
          }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
