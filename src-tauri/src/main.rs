// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use serde_json::json;

// Embedded vanilla databases
const VANILLA_STD: &str = include_str!("../../data/colors.json");
const VANILLA_SEKAI: &str = include_str!("../../data/colors_sekai.json");
const VANILLA_UNIT: &str = include_str!("../../data/colors_unit.json");
const VANILLA_PATCHNOTES: &str = include_str!("../../data/patchnotes.json");

fn strip_bom(s: &str) -> &str {
    s.strip_prefix('\u{FEFF}').unwrap_or(s)
}

// Helper to get data directory path (checks exe dir first, then current dir)
fn get_data_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let mut path = exe_dir.to_path_buf();
            for _ in 0..5 {
                if path.join("data").is_dir() {
                    return path.join("data");
                }
                if let Some(parent) = path.parent() {
                    path = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for _ in 0..5 {
        if path.join("data").is_dir() {
            return path.join("data");
        }
        if let Some(parent) = path.parent() {
            path = parent.to_path_buf();
        } else {
            break;
        }
    }
    PathBuf::from("data")
}

// Helper to get logs directory path
fn get_logs_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let mut path = exe_dir.to_path_buf();
            for _ in 0..5 {
                if path.join("logs").is_dir() {
                    return path.join("logs");
                }
                if let Some(parent) = path.parent() {
                    path = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for _ in 0..5 {
        if path.join("logs").is_dir() {
            return path.join("logs");
        }
        if let Some(parent) = path.parent() {
            path = parent.to_path_buf();
        } else {
            break;
        }
    }
    PathBuf::from("logs")
}

// Sanitize filename to only contain safe characters (matches PowerShell server behavior)
fn sanitize_filename(filename: &str) -> String {
    let mut safe_name = String::new();
    for c in filename.chars() {
        let code = c as u32;
        if (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || // A-Z, a-z
           (code >= 48 && code <= 57) || // 0-9
           code == 32 || code == 45 || code == 95 || code == 46 || // space, hyphen, underscore, dot
           (code >= 0x3130 && code <= 0x318F) || // Hangul Compatibility Jamo
           (code >= 0xAC00 && code <= 0xD7A3) { // Hangul Syllables
            safe_name.push(c);
        }
    }
    let trimmed = safe_name.trim().to_string();
    if trimmed.is_empty() {
        "lyrics".to_string()
    } else {
        trimmed
    }
}

// 1. Config management
#[tauri::command]
fn load_config() -> Result<serde_json::Value, String> {
    let config_path = get_data_dir().join("config.json");
    if config_path.exists() {
        let data = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        let json: serde_json::Value = serde_json::from_str(strip_bom(&data))
            .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
        Ok(json)
    } else {
        Ok(json!({}))
    }
}

#[tauri::command]
fn save_config(config: serde_json::Value) -> Result<(), String> {
    let config_path = get_data_dir().join("config.json");
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    let data = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, data)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

// 2. Character management
fn get_character_db_path(category: &str) -> PathBuf {
    let filename = match category {
        "sekai" => "colors_sekai.json",
        "unit" => "colors_unit.json",
        _ => "colors.json",
    };
    get_data_dir().join(filename)
}

fn get_custom_character_db_path(category: &str) -> PathBuf {
    let filename = match category {
        "sekai" => "custom_colors_sekai.json",
        "unit" => "custom_colors_unit.json",
        _ => "custom_colors.json",
    };
    get_data_dir().join(filename)
}

#[tauri::command]
fn save_character(
    category: String,
    is_edit: bool,
    orig_name: String,
    name: String,
    color1: serde_json::Value,
    color2: serde_json::Value,
    aliases: Vec<String>,
) -> Result<(), String> {
    let custom_path = get_custom_character_db_path(&category);
    
    // 1. Load existing custom database
    let mut custom_db: serde_json::Map<String, serde_json::Value> = if custom_path.exists() {
        let content = fs::read_to_string(&custom_path)
            .map_err(|e| format!("Failed to read custom character file: {}", e))?;
        serde_json::from_str(strip_bom(&content)).unwrap_or_else(|_| serde_json::Map::new())
    } else {
        serde_json::Map::new()
    };

    // 2. Handle name changes during edit
    if is_edit && !orig_name.is_empty() && orig_name != name {
        // If the old name was in the original (pure) database, we must hide it via deleted: true
        let org_path = get_character_db_path(&category);
        let mut in_original = false;
        if org_path.exists() {
            if let Ok(content) = fs::read_to_string(&org_path) {
                if let Ok(serde_json::Value::Object(org_map)) = serde_json::from_str::<serde_json::Value>(strip_bom(&content)) {
                    if org_map.contains_key(&orig_name) {
                        in_original = true;
                    }
                }
            }
        }

        if in_original {
            custom_db.insert(orig_name, json!({ "deleted": true }));
        } else {
            custom_db.remove(&orig_name);
        }
    }

    // 3. Determine if the new character modifies a pure character or adds a new one
    let org_path = get_character_db_path(&category);
    let mut in_original = false;
    if org_path.exists() {
        if let Ok(content) = fs::read_to_string(&org_path) {
            if let Ok(serde_json::Value::Object(org_map)) = serde_json::from_str::<serde_json::Value>(strip_bom(&content)) {
                if org_map.contains_key(&name) {
                    in_original = true;
                }
            }
        }
    }

    let custom_type = if in_original { "modified" } else { "added" };

    // 4. Build custom entry
    let char_entry = json!({
        "color_1": {
            "bg": color1.get("bg").cloned().unwrap_or(json!("")),
            "txt": color1.get("txt").cloned().unwrap_or(json!(""))
        },
        "color_2": {
            "bg": color2.get("bg").cloned().unwrap_or(json!("")),
            "txt": color2.get("txt").cloned().unwrap_or(json!(""))
        },
        "aliases": aliases,
        "deleted": false,
        "custom_type": custom_type
    });

    custom_db.insert(name, char_entry);

    // 5. Save custom database back to disk
    if let Some(parent) = custom_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    let json_str = serde_json::to_string_pretty(&custom_db)
        .map_err(|e| format!("Failed to serialize custom character database: {}", e))?;
    fs::write(&custom_path, json_str)
        .map_err(|e| format!("Failed to write custom character database: {}", e))?;

    Ok(())
}

#[tauri::command]
fn delete_character(category: String, name: String) -> Result<(), String> {
    let custom_path = get_custom_character_db_path(&category);
    
    // 1. Load existing custom database
    let mut custom_db: serde_json::Map<String, serde_json::Value> = if custom_path.exists() {
        let content = fs::read_to_string(&custom_path)
            .map_err(|e| format!("Failed to read custom character file: {}", e))?;
        serde_json::from_str(strip_bom(&content)).unwrap_or_else(|_| serde_json::Map::new())
    } else {
        serde_json::Map::new()
    };

    // 2. Check if the character belongs to the pure database
    let org_path = get_character_db_path(&category);
    let mut in_original = false;
    if org_path.exists() {
        if let Ok(content) = fs::read_to_string(&org_path) {
            if let Ok(serde_json::Value::Object(org_map)) = serde_json::from_str::<serde_json::Value>(strip_bom(&content)) {
                if org_map.contains_key(&name) {
                    in_original = true;
                }
            }
        }
    }

    if in_original {
        // If in original DB, mark as deleted: true in custom DB to override/hide it
        custom_db.insert(name, json!({ "deleted": true }));
    } else {
        // If only in custom DB, remove completely
        custom_db.remove(&name);
    }

    // 3. Save custom DB back to disk
    let json_str = serde_json::to_string_pretty(&custom_db)
        .map_err(|e| format!("Failed to serialize custom character database: {}", e))?;
    fs::write(&custom_path, json_str)
        .map_err(|e| format!("Failed to write custom character database: {}", e))?;

    Ok(())
}

#[tauri::command]
fn load_character_db(category: String) -> Result<serde_json::Value, String> {
    // 1. Load original (pure) database
    let org_path = get_character_db_path(&category);
    let mut merged_db = serde_json::Map::new();

    if org_path.exists() {
        if let Ok(content) = fs::read_to_string(&org_path) {
            if let Ok(serde_json::Value::Object(org_map)) = serde_json::from_str::<serde_json::Value>(strip_bom(&content)) {
                merged_db = org_map;
            }
        }
    }

    // 2. Load custom overrides and merge them
    let custom_path = get_custom_character_db_path(&category);
    if custom_path.exists() {
        if let Ok(content) = fs::read_to_string(&custom_path) {
            if let Ok(serde_json::Value::Object(custom_map)) = serde_json::from_str::<serde_json::Value>(strip_bom(&content)) {
                for (key, val) in custom_map {
                    let is_deleted = val.get("deleted").and_then(|d| d.as_bool()).unwrap_or(false);
                    if is_deleted {
                        merged_db.remove(&key);
                    } else {
                        merged_db.insert(key, val);
                    }
                }
            }
        }
    }

    Ok(serde_json::Value::Object(merged_db))
}


// 3. Lyrics management
#[tauri::command]
fn save_lyrics(filename: String, content: String) -> Result<serde_json::Value, String> {
    let lyrics_dir = get_data_dir().join("lyrics");
    fs::create_dir_all(&lyrics_dir)
        .map_err(|e| format!("Failed to create lyrics directory: {}", e))?;

    let clean_name = sanitize_filename(&filename);
    // Ensure clean_name does not have duplicate .txt if user passed one
    let base_name = if clean_name.to_lowercase().ends_with(".txt") {
        clean_name[..clean_name.len() - 4].to_string()
    } else {
        clean_name
    };

    let file_path = lyrics_dir.join(format!("{}.txt", base_name));
    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write lyrics: {}", e))?;

    let full_path_str = file_path.to_string_lossy().to_string();
    Ok(json!({
        "status": "success",
        "filename": format!("{}.txt", base_name),
        "path": full_path_str
    }))
}

#[tauri::command]
fn list_lyrics() -> Result<Vec<serde_json::Value>, String> {
    let lyrics_dir = get_data_dir().join("lyrics");
    if !lyrics_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    let entries = fs::read_dir(&lyrics_dir)
        .map_err(|e| format!("Failed to read lyrics directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "txt") {
                let metadata = entry.metadata().ok();
                let size = metadata.as_ref().map_or(0, |m| m.len());
                let mtime = metadata.as_ref()
                    .and_then(|m| m.modified().ok())
                    .and_then(|time| {
                        let datetime: chrono::DateTime<chrono::Local> = time.into();
                        Some(datetime.format("%Y-%m-%d %H:%M:%S").to_string())
                    })
                    .unwrap_or_else(|| "Unknown".to_string());

                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    files.push(json!({
                        "name": file_name.to_string(),
                        "size": size,
                        "mtime": mtime
                    }));
                }
            }
        }
    }

    // Sort by modified time descending (fallback: sort by name if mtime is Unknown)
    files.sort_by(|a, b| {
        let mtime_a = a.get("mtime").and_then(|m| m.as_str()).unwrap_or("");
        let mtime_b = b.get("mtime").and_then(|m| m.as_str()).unwrap_or("");
        mtime_b.cmp(mtime_a)
    });

    Ok(files)
}

#[tauri::command]
fn load_lyrics(filename: String) -> Result<serde_json::Value, String> {
    let lyrics_dir = get_data_dir().join("lyrics");
    
    // Sanitize filename, preserving path safety
    let clean_name = sanitize_filename(&filename);
    let file_path = lyrics_dir.join(&clean_name);

    let mut status = "error";
    let mut file_content = String::new();

    if file_path.is_file() {
        file_content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read lyrics file: {}", e))?;
        status = "success";
    }

    Ok(json!({
        "status": status,
        "content": file_content,
        "filename": clean_name
    }))
}

#[tauri::command]
fn delete_lyrics(filename: String) -> Result<(), String> {
    let lyrics_dir = get_data_dir().join("lyrics");
    let clean_name = sanitize_filename(&filename);
    
    // Ensure filename ends with .txt if not present
    let base_name = if clean_name.to_lowercase().ends_with(".txt") {
        clean_name[..clean_name.len() - 4].to_string()
    } else {
        clean_name
    };
    
    let file_path = lyrics_dir.join(format!("{}.txt", base_name));
    println!("[DEBUG] delete_lyrics called for: {:?}, target file: {:?}", filename, file_path);
    
    if file_path.is_file() {
        let mut attempts = 0;
        loop {
            match fs::remove_file(&file_path) {
                Ok(_) => {
                    println!("[DEBUG] delete_lyrics successfully deleted the file!");
                    break;
                }
                Err(e) => {
                    attempts += 1;
                    if attempts >= 20 {
                        let err_msg = format!("Failed to delete lyrics file after 20 attempts: {}", e);
                        println!("[ERROR] {}", err_msg);
                        let _ = log_error("ERR_DELETE_FAIL".to_string(), "IOError".to_string(), err_msg.clone(), "".to_string());
                        return Err(err_msg);
                    }
                    println!("[WARN] File delete lock detected. Retrying in 50ms... (Attempt {})", attempts);
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
            }
        }
        Ok(())
    } else {
        let warn_msg = format!("delete_lyrics file not found: {:?}", file_path);
        println!("[WARN] {}", warn_msg);
        let _ = log_error("WARN_DELETE_NOT_FOUND".to_string(), "Warning".to_string(), warn_msg, "".to_string());
        Ok(())
    }
}

// 4. Logging
#[tauri::command]
fn log_error(code: String, error_type: String, message: String, stack: String) -> Result<(), String> {
    let logs_dir = get_logs_dir();
    fs::create_dir_all(&logs_dir)
        .map_err(|e| format!("Failed to create logs directory: {}", e))?;

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    println!("\n========================= CLIENT RUNTIME ERROR DETECTED =========================");
    println!("Time: {}", now);
    println!("Code: {}", code);
    println!("Type: {}", error_type);
    println!("Message: {}", message);
    if !stack.is_empty() {
        println!("--------------------------- STACK TRACE ---------------------------");
        println!("{}", stack);
    }
    println!("=================================================================================\n");

    let log_path = logs_dir.join("error.log");

    // Check file size and rotate logs if current is > 10MB (10,485,760 bytes)
    if let Ok(metadata) = fs::metadata(&log_path) {
        if metadata.len() > 10_485_760 {
            let backup1_path = logs_dir.join("error.1.log");
            let backup2_path = logs_dir.join("error.2.log");
            
            // Rename backup 1 to backup 2 (overwrites backup 2 if exists)
            let _ = fs::rename(&backup1_path, &backup2_path);
            
            // Rename current to backup 1
            let _ = fs::rename(&log_path, &backup1_path);
        }
    }

    let log_content = format!(
        "[{}] [{}] [{}]\nMessage: {}\nStack: {}\n---------------------------------------------------------------------------------\n\n",
        now, code, error_type, message, stack
    );

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    use std::io::Write;
    file.write_all(log_content.as_bytes())
        .map_err(|e| format!("Failed to write log file: {}", e))?;

    Ok(())
}

#[tauri::command]
fn log_text(raw_text: String, markdown_code: String) -> Result<(), String> {
    let logs_dir = get_logs_dir();
    fs::create_dir_all(&logs_dir)
        .map_err(|e| format!("Failed to create logs directory: {}", e))?;

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let log_path = logs_dir.join("editor_debug.log");
    let log_content = format!(
        "=================================================================================\n[REAL-TIME LOG TIME] {}\n=================================================================================\n[RAW EDITOR TEXT]\n{}\n\n[COMPILED MARKDOWN CODE]\n{}\n=================================================================================\n",
        now, raw_text, markdown_code
    );

    fs::write(log_path, log_content)
        .map_err(|e| format!("Failed to write debug log: {}", e))?;

    Ok(())
}

#[tauri::command]
fn force_exit() {
    std::process::exit(1);
}

#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

// Helper to make sure default DB files exist on startup
fn ensure_db_files_exist() -> Result<(), String> {
    let data_dir = get_data_dir();
    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data directory: {}", e))?;

    let std_path = data_dir.join("colors.json");
    if !std_path.exists() {
        fs::write(&std_path, strip_bom(VANILLA_STD))
            .map_err(|e| format!("Failed to write default colors.json: {}", e))?;
    }

    let sekai_path = data_dir.join("colors_sekai.json");
    if !sekai_path.exists() {
        fs::write(&sekai_path, strip_bom(VANILLA_SEKAI))
            .map_err(|e| format!("Failed to write default colors_sekai.json: {}", e))?;
    }

    let unit_path = data_dir.join("colors_unit.json");
    if !unit_path.exists() {
        fs::write(&unit_path, strip_bom(VANILLA_UNIT))
            .map_err(|e| format!("Failed to write default colors_unit.json: {}", e))?;
    }

    let patchnotes_path = data_dir.join("patchnotes.json");
    if !patchnotes_path.exists() {
        fs::write(&patchnotes_path, strip_bom(VANILLA_PATCHNOTES))
            .map_err(|e| format!("Failed to write default patchnotes.json: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn load_patchnotes() -> Result<serde_json::Value, String> {
    let data_dir = get_data_dir();
    let patchnotes_path = data_dir.join("patchnotes.json");
    if !patchnotes_path.exists() {
        fs::write(&patchnotes_path, strip_bom(VANILLA_PATCHNOTES))
            .map_err(|e| format!("Failed to write default patchnotes.json: {}", e))?;
    }

    let content = fs::read_to_string(&patchnotes_path)
        .map_err(|e| format!("Failed to read patchnotes.json: {}", e))?;

    serde_json::from_str(strip_bom(&content))
        .map_err(|e| format!("Failed to parse patchnotes.json: {}", e))
}

#[tauri::command]
fn open_new_window() -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    
    std::process::Command::new(current_exe)
        .spawn()
        .map_err(|e| format!("Failed to spawn new process: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn reset_all_data() -> Result<(), String> {
    let data_dir = get_data_dir();
    let targets = [
        "config.json",
        "custom_colors.json",
        "custom_colors_sekai.json",
        "custom_colors_unit.json",
    ];
    for name in &targets {
        let path = data_dir.join(name);
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
    }
    Ok(())
}

fn main() {
    let _ = ensure_db_files_exist();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            save_character,
            delete_character,
            load_character_db,
            save_lyrics,
            list_lyrics,
            load_lyrics,
            delete_lyrics,
            load_patchnotes,
            log_error,
            log_text,
            force_exit,
            exit_app,
            open_new_window,
            reset_all_data
        ])
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = event.window().emit("close-requested", ());
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

