#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;
use eframe::egui;

fn strip_bom(s: &str) -> &str {
    s.strip_prefix('\u{FEFF}').unwrap_or(s)
}

// Embed binary resources
const MAIN_EXE: &[u8] = include_bytes!("../../배포 폴더/NamuVocaroLyric.exe");
const MANUAL_PDF: &[u8] = include_bytes!("../../배포 폴더/사용설명서.pdf");
const LICENSE_DATA: &str = include_str!("../../배포 폴더/source_code/LICENSE_DATA.txt");
const VANILLA_STD: &str = include_str!("../../data/colors.json");
const VANILLA_SEKAI: &str = include_str!("../../data/colors_sekai.json");
const VANILLA_UNIT: &str = include_str!("../../data/colors_unit.json");

#[derive(Clone, Copy, PartialEq)]
enum AppMode {
    NewInstall,
    UpdateMigration,
}

enum ProgressEvent {
    Log(String),
    Progress(f32),
    Error(String),
    Done(bool), // true if migrated from 1.2.0 or below
}

struct UpdaterApp {
    mode: Option<AppMode>,
    install_path: String,
    create_shortcut: bool,
    migrated: bool,
    status_log: Vec<String>,
    progress: f32,
    is_working: bool,
    is_done: bool,
    error_msg: Option<String>,
    tx: Sender<ProgressEvent>,
    rx: Receiver<ProgressEvent>,
}

impl UpdaterApp {
    fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        // Configure styles to make it look premium
        configure_styles(&_cc.egui_ctx);

        let (tx, rx) = channel();
        
        // Auto-detect install path: check if running next to NamuVocaroLyric.exe
        let current_dir = std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .to_string_lossy()
            .to_string();
        
        let has_existing_exe = Path::new(&current_dir).join("NamuVocaroLyric.exe").exists();
        let mode = if has_existing_exe {
            Some(AppMode::UpdateMigration)
        } else {
            None
        };

        Self {
            mode,
            install_path: current_dir,
            create_shortcut: true,
            migrated: false,
            status_log: Vec::new(),
            progress: 0.0,
            is_working: false,
            is_done: false,
            error_msg: None,
            tx,
            rx,
        }
    }
}

fn configure_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();

    // 윈도우 시스템 한글 폰트 경로 우선 탐색
    let font_paths = [
        "C:\\Windows\\Fonts\\malgun.ttf",      // 맑은 고딕
        "C:\\Windows\\Fonts\\malgunbd.ttf",    // 맑은 고딕 Bold
        "C:\\Windows\\Fonts\\gulim.ttc",       // 굴림
        "C:\\Windows\\Fonts\\batang.ttc",      // 바탕
    ];

    let mut loaded = false;
    for path in &font_paths {
        if let Ok(font_data) = std::fs::read(path) {
            fonts.font_data.insert(
                "korean_system_font".to_owned(),
                egui::FontData::from_owned(font_data),
            );
            fonts.families.get_mut(&egui::FontFamily::Proportional)
                .unwrap()
                .insert(0, "korean_system_font".to_owned());
            fonts.families.get_mut(&egui::FontFamily::Monospace)
                .unwrap()
                .insert(0, "korean_system_font".to_owned());
            loaded = true;
            break;
        }
    }

    if loaded {
        ctx.set_fonts(fonts);
    }
}

fn configure_styles(ctx: &egui::Context) {
    configure_fonts(ctx);
    
    let mut visuals = egui::Visuals::light();
    visuals.window_rounding = 12.0.into();
    visuals.panel_fill = egui::Color32::from_rgb(245, 246, 248); // bg-app
    
    visuals.widgets.noninteractive.rounding = 6.0.into();
    visuals.widgets.inactive.rounding = 6.0.into();
    visuals.widgets.hovered.rounding = 6.0.into();
    visuals.widgets.active.rounding = 6.0.into();
    
    visuals.widgets.inactive.bg_fill = egui::Color32::from_rgb(255, 255, 255); // bg-pane
    visuals.widgets.inactive.bg_stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(228, 232, 235));
    visuals.widgets.inactive.fg_stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(43, 43, 43));
    
    visuals.widgets.hovered.bg_fill = egui::Color32::from_rgb(245, 246, 248); // bg-app
    visuals.widgets.hovered.bg_stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(228, 232, 235));
    
    visuals.widgets.active.bg_fill = egui::Color32::from_rgb(228, 232, 235);
    
    ctx.set_visuals(visuals);
}

impl eframe::App for UpdaterApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Process background thread messages
        while let Ok(event) = self.rx.try_recv() {
            match event {
                ProgressEvent::Log(msg) => self.status_log.push(msg),
                ProgressEvent::Progress(p) => self.progress = p,
                ProgressEvent::Error(err) => {
                    self.status_log.push(format!("[실패] {}", err));
                    self.error_msg = Some(err);
                    self.is_working = false;
                }
                ProgressEvent::Done(migrated) => {
                    self.progress = 1.0;
                    self.is_working = false;
                    self.is_done = true;
                    self.migrated = migrated;
                }
            }
        }

        // Keep repainting if working to update progress and logs in real-time
        if self.is_working {
            ctx.request_repaint();
        }

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.vertical(|ui| {
                // 1. Content Area (Fixed height area for title and options, leaving space for footer)
                ui.allocate_ui_with_layout(
                    egui::vec2(ui.available_width(), 335.0),
                    egui::Layout::top_down(egui::Align::Min),
                    |ui| {
                        // Header Banner
                        ui.add_space(5.0);
                        ui.heading(
                            egui::RichText::new("NamuVocaroLyric v1.5.1 설치 및 업데이트")
                                .size(18.0)
                                .strong()
                                .color(egui::Color32::from_rgb(43, 43, 43)), // text-primary
                        );
                        ui.label(
                            egui::RichText::new("컴퓨터에 프로그램을 신규 설치하거나 기존 데이터베이스를 업데이트합니다.")
                                .size(11.5)
                                .color(egui::Color32::from_rgb(102, 102, 102)), // text-secondary
                        );
                        ui.add_space(15.0);

                        if self.is_working {
                            // Working screen (Progress Bar and Logs)
                            ui.vertical(|ui| {
                                ui.label(egui::RichText::new("설치 및 데이터 이관 진행 중...").strong());
                                ui.add_space(8.0);
                                ui.add(egui::ProgressBar::new(self.progress).show_percentage());
                                ui.add_space(15.0);
                                
                                ui.label(egui::RichText::new("진행 기록:").size(12.0));
                                ui.add_space(4.0);
                                egui::ScrollArea::vertical()
                                    .max_height(160.0)
                                    .min_scrolled_height(160.0)
                                    .show(ui, |ui| {
                                        ui.set_width(ui.available_width());
                                        for log in &self.status_log {
                                            ui.label(egui::RichText::new(log).size(11.0));
                                        }
                                    });
                            });
                        } else if self.is_done {
                            // Completion screen
                            ui.vertical(|ui| {
                                ui.add_space(10.0);
                                let heading_text = if self.mode == Some(AppMode::UpdateMigration) {
                                     "🎉 업데이트가 완료되었습니다!"
                                 } else {
                                     "🎉 설치가 완료되었습니다!"
                                 };
                                 ui.heading(
                                     egui::RichText::new(heading_text)
                                         .size(16.0)
                                         .strong()
                                         .color(egui::Color32::from_rgb(52, 168, 83)), // Success Green
                                 );
                                ui.add_space(15.0);
                                
                                if self.mode == Some(AppMode::UpdateMigration) {
                                     if self.migrated {
                                         ui.label("기존 데이터베이스 마이그레이션 및 1.5.1 버전 업데이트가 성공적으로 끝났습니다.");
                                         ui.label("기존 사용자 지정 설정과 색상 값은 custom_colors.json으로 안전하게 분리 백업되었습니다.");
                                     } else {
                                         ui.label("1.5.1 버전 업데이트가 성공적으로 끝났습니다.");
                                     }
                                } else {
                                    ui.label("NamuVocaroLyric 프로그램의 신규 설치가 깨끗하게 완료되었습니다.");
                                    ui.label("설치 경로에 메인 프로그램, 사용 설명서 및 순정 DB 자산들이 복사되었습니다.");
                                }
                                ui.add_space(20.0);
                                ui.label("아래 [완료] 혹은 [프로그램 실행] 버튼을 눌러 설치 프로그램을 종료하십시오.");
                            });
                        } else if let Some(err) = self.error_msg.clone() {
                            // Error screen
                            ui.vertical(|ui| {
                                ui.heading(
                                    egui::RichText::new("⚠️ 설치 중 오류가 발생했습니다.")
                                         .size(16.0)
                                         .strong()
                                         .color(egui::Color32::from_rgb(234, 67, 53)), // Danger Red
                                );
                                ui.add_space(10.0);
                                ui.label("오류 원인을 확인하시고 다시 시도해 주십시오.");
                                ui.add_space(10.0);
                                
                                egui::ScrollArea::vertical()
                                    .max_height(160.0)
                                    .min_scrolled_height(160.0)
                                    .show(ui, |ui| {
                                        ui.set_width(ui.available_width());
                                        ui.label(egui::RichText::new(format!("에러 세부 정보:\n{}", err)).color(egui::Color32::from_rgb(185, 28, 28)).size(11.5));
                                    });
                            });
                        } else {
                            // Setup configuration screen (Mode and Path selection)
                            ui.vertical(|ui| {
                                ui.label(egui::RichText::new("1. 설치 유형을 선택해 주십시오:").strong().size(12.5));
                                ui.add_space(8.0);
                                
                                ui.horizontal(|ui| {
                                    // Card 1: Update
                                    let is_selected_update = self.mode == Some(AppMode::UpdateMigration);
                                    let response_update = egui::Frame::group(ui.style())
                                        .fill(if is_selected_update {
                                            egui::Color32::from_rgb(235, 249, 248) // Light Accent
                                        } else {
                                            egui::Color32::from_rgb(255, 255, 255) // White
                                        })
                                        .stroke(egui::Stroke::new(1.0, if is_selected_update {
                                            egui::Color32::from_rgb(57, 197, 187)   // Accent
                                        } else {
                                            egui::Color32::from_rgb(228, 232, 235)  // Border
                                        }))
                                        .show(ui, |ui| {
                                            ui.vertical(|ui| {
                                                ui.set_width(235.0);
                                                ui.set_height(75.0);
                                                ui.label(
                                                    egui::RichText::new("업데이트 & 마이그레이션 (기존 사용자)")
                                                        .size(13.0)
                                                        .strong()
                                                        .color(if is_selected_update {
                                                            egui::Color32::from_rgb(35, 160, 150) // Darker Accent
                                                        } else {
                                                            egui::Color32::from_rgb(102, 102, 102) // Text secondary
                                                        })
                                                );
                                                ui.add_space(4.0);
                                                ui.small("기존 1.2.0 이하 버전의 데이터를 유지하며\n1.5.1으로 안전하게 업데이트합니다.");
                                            });
                                        })
                                        .response;

                                    let response_update = ui.interact(response_update.rect, response_update.id, egui::Sense::click());
                                    if response_update.clicked() {
                                        self.mode = Some(AppMode::UpdateMigration);
                                    }

                                    // Card 2: Install
                                    let is_selected_install = self.mode == Some(AppMode::NewInstall);
                                    let response_install = egui::Frame::group(ui.style())
                                        .fill(if is_selected_install {
                                            egui::Color32::from_rgb(235, 249, 248) // Light Accent
                                        } else {
                                            egui::Color32::from_rgb(255, 255, 255) // White
                                        })
                                        .stroke(egui::Stroke::new(1.0, if is_selected_install {
                                            egui::Color32::from_rgb(57, 197, 187)   // Accent
                                        } else {
                                            egui::Color32::from_rgb(228, 232, 235)  // Border
                                        }))
                                        .show(ui, |ui| {
                                            ui.vertical(|ui| {
                                                ui.set_width(235.0);
                                                ui.set_height(75.0);
                                                ui.label(
                                                    egui::RichText::new("신규 설치 (처음 사용자)")
                                                        .size(13.0)
                                                        .strong()
                                                        .color(if is_selected_install {
                                                            egui::Color32::from_rgb(35, 160, 150)
                                                        } else {
                                                            egui::Color32::from_rgb(102, 102, 102)
                                                        })
                                                );
                                                ui.add_space(4.0);
                                                ui.small("새로운 폴더에 최신 프로그램과\n순정 데이터베이스를 신규 설치합니다.");
                                            });
                                        })
                                        .response;

                                    let response_install = ui.interact(response_install.rect, response_install.id, egui::Sense::click());
                                    if response_install.clicked() {
                                        self.mode = Some(AppMode::NewInstall);
                                    }
                                });
                                ui.add_space(15.0);

                                ui.label(egui::RichText::new("2. 설치 폴더를 지정해 주십시오:").strong().size(12.5));
                                ui.add_space(8.0);
                                ui.horizontal(|ui| {
                                    ui.text_edit_singleline(&mut self.install_path);
                                    if ui.button("대상 변경...").clicked() {
                                        if let Some(path) = rfd::FileDialog::new().pick_folder() {
                                            self.install_path = path.to_string_lossy().to_string();
                                        }
                                    }
                                });
                                ui.add_space(5.0);
                                
                                // Recommendation label
                                let path = Path::new(&self.install_path);
                                if path.exists() {
                                    let has_exe = path.join("NamuVocaroLyric.exe").exists();
                                    let has_db = path.join("data").join("colors.json").exists();
                                    if has_exe || has_db {
                                        ui.label(
                                            egui::RichText::new("💡 지정된 폴더에 기존 버전이 발견되었습니다. '업데이트' 모드를 권장합니다.")
                                                .color(egui::Color32::from_rgb(217, 119, 6)), // Amber 600
                                        );
                                    } else {
                                        ui.label("💡 깨끗한 폴더입니다. '신규 설치' 모드를 권장합니다.");
                                    }
                                }
                                
                                ui.add_space(10.0);
                                ui.label(egui::RichText::new("3. 추가 옵션:").strong().size(12.5));
                                ui.add_space(6.0);
                                ui.checkbox(&mut self.create_shortcut, "바탕화면에 NamuVocaroLyric 바로가기 만들기");
                            });
                        }
                    }
                );

                // 2. Footer Separator (Bandizip flat style)
                ui.separator();

                // 3. Footer Area (Aligned right-to-left)
                ui.add_space(2.0);
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if self.is_working {
                        // While installing, show disabled status button
                        ui.add_enabled(
                            false,
                            egui::Button::new("설치 중...")
                                .min_size(egui::vec2(90.0, 28.0))
                        );
                    } else if self.is_done {
                        // Completed screen
                        if ui.add(egui::Button::new("닫기").min_size(egui::vec2(90.0, 28.0))).clicked() {
                            std::process::exit(0);
                        }
                        ui.add_space(8.0);
                        let run_btn = ui.add(
                            egui::Button::new(egui::RichText::new("프로그램 실행").strong().color(egui::Color32::WHITE))
                                .fill(egui::Color32::from_rgb(57, 197, 187)) // Accent
                                .min_size(egui::vec2(110.0, 28.0))
                        );
                        if run_btn.clicked() {
                            let exe_path = Path::new(&self.install_path).join("NamuVocaroLyric.exe");
                            let _ = std::process::Command::new(exe_path).spawn();
                            std::process::exit(0);
                        }
                    } else if self.error_msg.is_some() {
                        // Error screen
                        if ui.add(egui::Button::new("닫기").min_size(egui::vec2(90.0, 28.0))).clicked() {
                            std::process::exit(0);
                        }
                        ui.add_space(8.0);
                        if ui.add(egui::Button::new("다시 시도").min_size(egui::vec2(90.0, 28.0))).clicked() {
                            self.error_msg = None;
                            self.status_log.clear();
                            self.progress = 0.0;
                        }
                    } else {
                        // Config stage
                        if ui.add(egui::Button::new("취소").min_size(egui::vec2(90.0, 28.0))).clicked() {
                            std::process::exit(0);
                        }
                        ui.add_space(8.0);
                        
                        if let Some(selected_mode) = self.mode {
                            let action_text = match selected_mode {
                                AppMode::NewInstall => "설치",
                                AppMode::UpdateMigration => "업데이트",
                            };
                            
                            let install_btn = ui.add(
                                egui::Button::new(egui::RichText::new(action_text).strong().color(egui::Color32::WHITE))
                                    .fill(egui::Color32::from_rgb(57, 197, 187)) // Accent
                                    .min_size(egui::vec2(90.0, 28.0))
                            );
                            
                            if install_btn.clicked() {
                                // For NewInstall mode, automatically append "NamuVocaroLyric" to the installation path if it doesn't already end with it.
                                let mut path_str = self.install_path.clone();
                                if selected_mode == AppMode::NewInstall {
                                    let mut path = PathBuf::from(&path_str);
                                    let last_component = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                                    if !last_component.eq_ignore_ascii_case("NamuVocaroLyric") {
                                        path = path.join("NamuVocaroLyric");
                                        path_str = path.to_string_lossy().to_string();
                                        self.install_path = path_str.clone(); // Update UI path
                                    }
                                }

                                self.is_working = true;
                                let tx = self.tx.clone();
                                let final_path_str = path_str.clone();
                                let create_shortcut = self.create_shortcut;
                                
                                thread::spawn(move || {
                                    match run_installer(selected_mode, final_path_str, create_shortcut, tx.clone()) {
                                        Err(e) => {
                                            let _ = tx.send(ProgressEvent::Error(e));
                                        }
                                        Ok(migrated) => {
                                            let _ = tx.send(ProgressEvent::Done(migrated));
                                        }
                                    }
                                });
                            }
                        } else {
                            ui.add_enabled(
                                false,
                                egui::Button::new("설치")
                                    .min_size(egui::vec2(90.0, 28.0))
                            );
                        }
                    }
                });
            });
        });
    }
}

// Check and terminate NamuVocaroLyric.exe if running
fn kill_running_process(tx: &Sender<ProgressEvent>) {
    let _ = tx.send(ProgressEvent::Log("실행 중인 NamuVocaroLyric.exe가 있는지 확인 중...".to_string()));
    
    use sysinfo::System;
    let mut system = System::new_all();
    system.refresh_all();
    
    let mut killed_any = false;
    for process in system.processes().values() {
        if process.name().eq_ignore_ascii_case("NamuVocaroLyric.exe") {
            let _ = tx.send(ProgressEvent::Log(format!("실행 중인 프로세스 발견 (PID: {}). 종료를 요청합니다.", process.pid())));
            let _ = process.kill();
            killed_any = true;
        }
    }
    
    if killed_any {
        let _ = tx.send(ProgressEvent::Log("프로세스 정리를 위해 대기 중...".to_string()));
        thread::sleep(std::time::Duration::from_millis(800));
    } else {
        let _ = tx.send(ProgressEvent::Log("실행 중인 프로세스가 없습니다.".to_string()));
    }
}

// Create a Windows desktop shortcut (.lnk) using PowerShell COM automation (robust to OneDrive redirection)
fn create_desktop_shortcut(install_path: &str) -> Result<(), String> {
    let ps_script = format!(
        "$DesktopPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop); \
         $WshShell = New-Object -ComObject WScript.Shell; \
         $Shortcut = $WshShell.CreateShortcut(\"$DesktopPath\\NamuVocaroLyric.lnk\"); \
         $Shortcut.TargetPath = '{}'; \
         $Shortcut.WorkingDirectory = '{}'; \
         $Shortcut.Save()",
        Path::new(install_path).join("NamuVocaroLyric.exe").to_string_lossy().replace("'", "''"),
        install_path.replace("'", "''")
    );

    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_script])
        .status()
        .map_err(|e| format!("PowerShell 실행 실패: {}", e))?;

    if !status.success() {
        return Err("바로가기 생성을 완료하지 못했습니다.".to_string());
    }

    Ok(())
}

fn run_installer(mode: AppMode, target_path_str: String, create_shortcut: bool, tx: Sender<ProgressEvent>) -> Result<bool, String> {
    let target_dir = Path::new(&target_path_str);
    if !target_dir.exists() {
        fs::create_dir_all(target_dir).map_err(|e| format!("대상 디렉토리를 생성할 수 없습니다: {}", e))?;
    }

    let data_dir = target_dir.join("data");
    fs::create_dir_all(&data_dir).map_err(|e| format!("data 디렉토리를 생성할 수 없습니다: {}", e))?;

    // Check if we are migrating from a version lower than 1.3.0
    let mut is_migrating_from_pre_1_3 = false;
    if mode == AppMode::UpdateMigration {
        let config_path = data_dir.join("config.json");
        let mut has_1_3_keys = false;
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(serde_json::Value::Object(map)) = serde_json::from_str(strip_bom(&content)) {
                    has_1_3_keys = map.contains_key("font") || map.contains_key("pureBlack") || map.contains_key("db_version");
                }
            }
        }
        let is_1_3_plus = target_dir.join("source_code").join("LICENSE_DATA.txt").exists() || has_1_3_keys;
        is_migrating_from_pre_1_3 = !is_1_3_plus;
    }

    if mode == AppMode::UpdateMigration {
        // 1. Terminate old process
        let _ = tx.send(ProgressEvent::Progress(0.1));
        kill_running_process(&tx);

        // 2. Load Vanilla DBs
        let vanilla_std_map: serde_json::Map<String, serde_json::Value> = serde_json::from_str(strip_bom(VANILLA_STD))
            .map_err(|e| format!("내장 순정 standard DB 파싱 실패: {}", e))?;
        let vanilla_sekai_map: serde_json::Map<String, serde_json::Value> = serde_json::from_str(strip_bom(VANILLA_SEKAI))
            .map_err(|e| format!("내장 순정 sekai DB 파싱 실패: {}", e))?;
        let vanilla_unit_map: serde_json::Map<String, serde_json::Value> = serde_json::from_str(strip_bom(VANILLA_UNIT))
            .map_err(|e| format!("내장 순정 unit DB 파싱 실패: {}", e))?;

        // 3. Migrate database files
        let categories = vec![
            ("standard", "colors.json", "custom_colors.json", &vanilla_std_map),
            ("sekai", "colors_sekai.json", "custom_colors_sekai.json", &vanilla_sekai_map),
            ("unit", "colors_unit.json", "custom_colors_unit.json", &vanilla_unit_map),
        ];

        let _ = tx.send(ProgressEvent::Progress(0.3));
        for (cat_name, db_filename, custom_filename, vanilla_map) in categories {
            let db_path = data_dir.join(db_filename);
            let custom_path = data_dir.join(custom_filename);

            if db_path.exists() {
                let _ = tx.send(ProgressEvent::Log(format!("기존 {} 캐릭터 데이터베이스 분석 중...", cat_name)));
                let old_content = fs::read_to_string(&db_path)
                    .map_err(|e| format!("기존 {} DB 파일을 읽지 못했습니다: {}", cat_name, e))?;
                
                if let Ok(serde_json::Value::Object(old_map)) = serde_json::from_str(strip_bom(&old_content)) {
                    // Perform diff
                    let custom_map = migrate_category_db(&old_map, vanilla_map);
                    
                    if !custom_map.is_empty() {
                        let _ = tx.send(ProgressEvent::Log(format!("-> 변경된 항목 발견! {} 에 백업 분리 저장 중...", custom_filename)));
                        let custom_json = serde_json::to_string_pretty(&serde_json::Value::Object(custom_map))
                            .map_err(|e| format!("커스텀 DB 직렬화 실패: {}", e))?;
                        fs::write(&custom_path, custom_json)
                            .map_err(|e| format!("{} 파일 쓰기 실패: {}", custom_filename, e))?;
                    } else {
                        let _ = tx.send(ProgressEvent::Log(format!("-> 변경된 항목이 없습니다. {}", cat_name)));
                    }
                } else {
                    let _ = tx.send(ProgressEvent::Log(format!("⚠️ 기존 {} DB 파일 포맷이 올바르지 않아 마이그레이션을 진행하지 않습니다.", cat_name)));
                }
            } else {
                let _ = tx.send(ProgressEvent::Log(format!("{} 파일이 존재하지 않아 마이그레이션을 진행하지 않습니다.", db_filename)));
            }
        }

        // 4. Overwrite databases with fresh vanilla colors
        let _ = tx.send(ProgressEvent::Progress(0.6));
        let _ = tx.send(ProgressEvent::Log("최신 순정 데이터베이스 복원 파일 쓰는 중...".to_string()));
        fs::write(data_dir.join("colors.json"), VANILLA_STD)
            .map_err(|e| format!("colors.json 쓰기 실패: {}", e))?;
        fs::write(data_dir.join("colors_sekai.json"), VANILLA_SEKAI)
            .map_err(|e| format!("colors_sekai.json 쓰기 실패: {}", e))?;
        fs::write(data_dir.join("colors_unit.json"), VANILLA_UNIT)
            .map_err(|e| format!("colors_unit.json 쓰기 실패: {}", e))?;

        // 5. Extract files
        let _ = tx.send(ProgressEvent::Progress(0.8));
        let _ = tx.send(ProgressEvent::Log("신규 NamuVocaroLyric.exe 파일 업데이트 중...".to_string()));
        let exe_path = target_dir.join("NamuVocaroLyric.exe");
        fs::write(exe_path, MAIN_EXE).map_err(|e| format!("실행 파일 교체 실패: {}", e))?;

        let _ = tx.send(ProgressEvent::Log("신규 사용설명서.pdf 파일 업데이트 중...".to_string()));
        let manual_path = target_dir.join("사용설명서.pdf");
        fs::write(manual_path, MANUAL_PDF).map_err(|e| format!("설명서 파일 교체 실패: {}", e))?;

        let _ = tx.send(ProgressEvent::Log("라이선스 고지 문서 업데이트 중...".to_string()));
        let src_code_dir = target_dir.join("source_code");
        fs::create_dir_all(&src_code_dir).map_err(|e| format!("source_code 디렉토리를 생성할 수 없습니다: {}", e))?;
        fs::write(src_code_dir.join("LICENSE_DATA.txt"), LICENSE_DATA).map_err(|e| format!("라이선스 파일 쓰기 실패: {}", e))?;

        // 6. Update config
        let _ = tx.send(ProgressEvent::Log("설정 파일 버전 메타정보 업데이트 중...".to_string()));
        let config_path = data_dir.join("config.json");
        let mut config_map = if config_path.exists() {
            let config_content = fs::read_to_string(&config_path).unwrap_or_else(|_| "{}".to_string());
            if let Ok(serde_json::Value::Object(map)) = serde_json::from_str(strip_bom(&config_content)) {
                map
            } else {
                serde_json::Map::new()
            }
        } else {
            serde_json::Map::new()
        };
        config_map.insert("db_version".to_string(), serde_json::Value::String("1.5.1".to_string()));
        let config_json = serde_json::to_string_pretty(&serde_json::Value::Object(config_map))
            .map_err(|e| format!("설정 파일 직렬화 실패: {}", e))?;
        fs::write(config_path, config_json).map_err(|e| format!("설정 파일 저장 실패: {}", e))?;

    } else {
        // New Installation Mode
        let _ = tx.send(ProgressEvent::Progress(0.2));
        let _ = tx.send(ProgressEvent::Log("순정 데이터베이스 파일 쓰는 중...".to_string()));
        fs::write(data_dir.join("colors.json"), VANILLA_STD)
            .map_err(|e| format!("colors.json 쓰기 실패: {}", e))?;
        fs::write(data_dir.join("colors_sekai.json"), VANILLA_SEKAI)
            .map_err(|e| format!("colors_sekai.json 쓰기 실패: {}", e))?;
        fs::write(data_dir.join("colors_unit.json"), VANILLA_UNIT)
            .map_err(|e| format!("colors_unit.json 쓰기 실패: {}", e))?;

        let _ = tx.send(ProgressEvent::Progress(0.4));
        let _ = tx.send(ProgressEvent::Log("기본 설정 파일 생성 중...".to_string()));
        let default_config = serde_json::json!({
            "theme": "light",
            "defaultTab": "visual",
            "font": "system",
            "pureBlack": false,
            "isPreviewLoggerActive": true,
            "isTextLoggerActive": true,
            "isDevModeActive": true,
            "db_version": "1.5.1"
        });
        let config_json = serde_json::to_string_pretty(&default_config)
            .map_err(|e| format!("설정 파일 직렬화 실패: {}", e))?;
        fs::write(data_dir.join("config.json"), config_json)
            .map_err(|e| format!("config.json 쓰기 실패: {}", e))?;

        let _ = tx.send(ProgressEvent::Progress(0.7));
        let _ = tx.send(ProgressEvent::Log("NamuVocaroLyric.exe 파일 복사 중...".to_string()));
        let exe_path = target_dir.join("NamuVocaroLyric.exe");
        fs::write(exe_path, MAIN_EXE).map_err(|e| format!("실행 파일 쓰기 실패: {}", e))?;

        let _ = tx.send(ProgressEvent::Log("사용설명서.pdf 파일 복사 중...".to_string()));
        let manual_path = target_dir.join("사용설명서.pdf");
        fs::write(manual_path, MANUAL_PDF).map_err(|e| format!("설명서 파일 쓰기 실패: {}", e))?;

        let _ = tx.send(ProgressEvent::Log("라이선스 고지 문서 복사 중...".to_string()));
        let src_code_dir = target_dir.join("source_code");
        fs::create_dir_all(&src_code_dir).map_err(|e| format!("source_code 디렉토리를 생성할 수 없습니다: {}", e))?;
        fs::write(src_code_dir.join("LICENSE_DATA.txt"), LICENSE_DATA).map_err(|e| format!("라이선스 파일 쓰기 실패: {}", e))?;
    }

    if create_shortcut {
        let _ = tx.send(ProgressEvent::Log("바탕화면에 프로그램 바로가기 생성 중...".to_string()));
        if let Err(e) = create_desktop_shortcut(&target_path_str) {
            let _ = tx.send(ProgressEvent::Log(format!("⚠️ 바로가기 생성 실패: {}", e)));
        } else {
            let _ = tx.send(ProgressEvent::Log("바탕화면에 프로그램 바로가기 생성 완료".to_string()));
        }
    }

    let _ = tx.send(ProgressEvent::Progress(1.0));
    Ok(is_migrating_from_pre_1_3)
}

fn migrate_category_db(
    old_db: &serde_json::Map<String, serde_json::Value>,
    vanilla_db: &serde_json::Map<String, serde_json::Value>,
) -> serde_json::Map<String, serde_json::Value> {
    let mut custom_db = serde_json::Map::new();

    // 1. Find added and modified characters
    for (name, old_val) in old_db {
        if let Some(vanilla_val) = vanilla_db.get(name) {
            // Character exists in both. Let's compare colors & aliases.
            if !is_identical_character(old_val, vanilla_val) {
                // Modified
                let mut custom_entry = old_val.clone();
                if let serde_json::Value::Object(ref mut map) = custom_entry {
                    map.insert("custom_type".to_string(), serde_json::Value::String("modified".to_string()));
                    map.insert("deleted".to_string(), serde_json::Value::Bool(false));
                }
                custom_db.insert(name.clone(), custom_entry);
            }
        } else {
            // Added
            let mut custom_entry = old_val.clone();
            if let serde_json::Value::Object(ref mut map) = custom_entry {
                map.insert("custom_type".to_string(), serde_json::Value::String("added".to_string()));
                map.insert("deleted".to_string(), serde_json::Value::Bool(false));
            }
            custom_db.insert(name.clone(), custom_entry);
        }
    }

    // 2. Find deleted characters (characters in vanilla but not in old_db)
    for name in vanilla_db.keys() {
        if !old_db.contains_key(name) {
            // Deleted
            let mut custom_entry = serde_json::Map::new();
            custom_entry.insert("deleted".to_string(), serde_json::Value::Bool(true));
            custom_db.insert(name.clone(), serde_json::Value::Object(custom_entry));
        }
    }

    custom_db
}

fn is_identical_character(a: &serde_json::Value, b: &serde_json::Value) -> bool {
    let get_color_str = |val: &serde_json::Value, color_key: &str, field: &str| -> String {
        val.get(color_key)
            .and_then(|c| c.get(field))
            .and_then(|f| f.as_str())
            .unwrap_or("")
            .trim()
            .to_string()
    };

    let c1_bg_a = get_color_str(a, "color_1", "bg");
    let c1_bg_b = get_color_str(b, "color_1", "bg");
    let c1_txt_a = get_color_str(a, "color_1", "txt");
    let c1_txt_b = get_color_str(b, "color_1", "txt");

    let c2_bg_a = get_color_str(a, "color_2", "bg");
    let c2_bg_b = get_color_str(b, "color_2", "bg");
    let c2_txt_a = get_color_str(a, "color_2", "txt");
    let c2_txt_b = get_color_str(b, "color_2", "txt");

    if c1_bg_a != c1_bg_b || c1_txt_a != c1_txt_b || c2_bg_a != c2_bg_b || c2_txt_a != c2_txt_b {
        return false;
    }

    // Compare aliases (order-independent)
    let get_aliases = |val: &serde_json::Value| -> Vec<String> {
        val.get("aliases")
            .and_then(|a| a.as_array())
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .collect::<Vec<_>>()
    };

    let mut aliases_a = get_aliases(a);
    let mut aliases_b = get_aliases(b);
    aliases_a.sort();
    aliases_b.sort();

    aliases_a == aliases_b
}

fn main() -> Result<(), eframe::Error> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([540.0, 400.0])
            .with_resizable(false)
            .with_maximize_button(false),
        ..Default::default()
    };
    
    eframe::run_native(
        "NamuVocaroLyric 설치 및 업데이트 도우미",
        options,
        Box::new(|cc| Box::new(UpdaterApp::new(cc))),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migration_logic() {
        let temp_dir = std::env::temp_dir().join("namu_migration_test");
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
        fs::create_dir_all(&temp_dir).unwrap();

        let data_dir = temp_dir.join("data");
        fs::create_dir_all(&data_dir).unwrap();

        // 1. Create a dummy colors.json simulating 1.2.0 mixed DB
        let old_colors_json = r##"{
            "MEIKO": {
                "color_1": {
                    "bg": "#ffffff,#ffffff",
                    "txt": "#ffffff,#d80000"
                },
                "color_2": {
                    "bg": "#ffeaea,#3c2e34",
                    "txt": "#212529,#ffffff"
                },
                "aliases": ["메이코"]
            },
            "테스트 캐릭터": {
                "color_1": {
                    "bg": "#123456,#654321",
                    "txt": "#ffffff,#ffffff"
                },
                "color_2": {
                    "bg": "#000000,#ffffff",
                    "txt": "#ffffff,#000000"
                },
                "aliases": ["테스트", "test"]
            }
        }"##;
        fs::write(data_dir.join("colors.json"), old_colors_json).unwrap();
        fs::write(data_dir.join("colors_sekai.json"), "{}").unwrap();
        fs::write(data_dir.join("colors_unit.json"), "{}").unwrap();

        // Write a dummy exe so update mode doesn't complain
        fs::write(temp_dir.join("NamuVocaroLyric.exe"), "old exe").unwrap();

        // 2. Run the installer/migration function
        let (tx, rx) = channel();
        let temp_dir_clone = temp_dir.clone();
        let tx_clone = tx.clone();
        let handle = thread::spawn(move || {
            match run_installer(AppMode::UpdateMigration, temp_dir_clone.to_string_lossy().to_string(), false, tx_clone) {
                Ok(migrated) => {
                    let _ = tx.send(ProgressEvent::Done(migrated));
                }
                Err(e) => {
                    panic!("Installer failed: {}", e);
                }
            }
        });

        // Consume progress events
        let mut test_migrated = false;
        while let Ok(event) = rx.recv() {
            match event {
                ProgressEvent::Log(msg) => println!("LOG: {}", msg),
                ProgressEvent::Progress(p) => println!("PROGRESS: {:.2}", p),
                ProgressEvent::Error(err) => panic!("Installer failed: {}", err),
                ProgressEvent::Done(migrated) => {
                    test_migrated = migrated;
                    break;
                }
            }
        }
        handle.join().unwrap();
        assert!(test_migrated);

        // 3. Verify outcomes
        // custom_colors.json should contain the changes
        let custom_colors_path = data_dir.join("custom_colors.json");
        assert!(custom_colors_path.exists());
        let custom_content = fs::read_to_string(custom_colors_path).unwrap();
        let custom_val: serde_json::Value = serde_json::from_str(strip_bom(&custom_content)).unwrap();

        // "테스트 캐릭터" should be marked as "added"
        let test_char = custom_val.get("테스트 캐릭터").unwrap();
        assert_eq!(test_char.get("custom_type").unwrap().as_str().unwrap(), "added");
        assert_eq!(test_char.get("deleted").unwrap().as_bool().unwrap(), false);

        // "MEIKO" should be marked as "modified"
        let meiko_char = custom_val.get("MEIKO").unwrap();
        assert_eq!(meiko_char.get("custom_type").unwrap().as_str().unwrap(), "modified");
        assert_eq!(meiko_char.get("deleted").unwrap().as_bool().unwrap(), false);

        // "flower" was in vanilla but not in old_colors_json. It should be marked as "deleted"
        let flower_char = custom_val.get("flower").unwrap();
        assert_eq!(flower_char.get("deleted").unwrap().as_bool().unwrap(), true);

        // The original colors.json should now be the new vanilla colors
        let colors_json_path = data_dir.join("colors.json");
        let colors_content = fs::read_to_string(colors_json_path).unwrap();
        let colors_val: serde_json::Value = serde_json::from_str(strip_bom(&colors_content)).unwrap();
        // MEIKO in colors.json should have vanilla colors, not the custom ones
        let meiko_color_1_bg = colors_val.get("MEIKO").unwrap().get("color_1").unwrap().get("bg").unwrap().as_str().unwrap();
        assert_eq!(meiko_color_1_bg, "#d80000,#16171a");

        // The main exe, manual pdf and license file should be extracted
        assert!(temp_dir.join("NamuVocaroLyric.exe").exists());
        assert!(temp_dir.join("사용설명서.pdf").exists());
        assert!(temp_dir.join("source_code").join("LICENSE_DATA.txt").exists());

        // config.json should have version updated
        let config_path = data_dir.join("config.json");
        assert!(config_path.exists());
        let config_content = fs::read_to_string(config_path).unwrap();
        let config_val: serde_json::Value = serde_json::from_str(strip_bom(&config_content)).unwrap();
        assert_eq!(config_val.get("db_version").unwrap().as_str().unwrap(), "1.5.1");

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
