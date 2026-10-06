# SYSTEM PROMPT & ARCHITECTURAL SPECIFICATION FOR AI ASSISTANTS

> **PROJECT**: NamuVocaroLyric (나무보카로가사)  
> **CURRENT VERSION**: 1.6.0  
> **TARGET AUDIENCE**: AI Coding Agents, LLM Subagents, and Automation Models resuming or extending this repository.  
> **PRIMARY REPO PATH**: `C:\Users\kangd\Documents\antigravity\wonderful-pasteur`  
> **OPERATING SYSTEM**: Windows 10/11 (PowerShell environment)

---

## 1. MISSION & DOMAIN KNOWLEDGE

### 1.1 What is NamuVocaroLyric?
NamuVocaroLyric is a specialized desktop & upcoming web IDE designed specifically to compile, format, syntax-highlight, and structure lyrics for **Vocaloid, Piapro Characters, and Project SEKAI (보컬로이드 / 세카이)** songs into standard **Namuwiki (나무위키) table markup**.

### 1.2 Namuwiki Lyrics Markup Domain Rules
- **Three-tier Stanzas**: Standard lyric stanzas consist of Original Japanese (line 1), Romaji / Pronunciation (line 2), and Korean Translation (line 3).
- **Character Color Attributes**: Cells use inline hex style markup (e.g., `{{{#!wiki style="background-color: #33ccbb; color: #ffffff;" ...}}}` or `||<bgcolor=#33ccbb><color=#ffffff> ... ||`).
- **Parallel / Unit Stanzas**: Multiple vocalists singing simultaneously in side-by-side table columns.
- **Strict Text Integrity Principle**: **NEVER modify or "correct" typos, mondegreens, or idiosyncratic lyrics in user input or sample files**. Original lyrics must be treated as immutable raw data.

---

## 2. REPOSITORY & RUNTIME ARCHITECTURE (v1.6.0)

```
wonderful-pasteur/
├── src/                          # FRONTEND APPLICATION CORE
│   ├── index.html                # App shell, modals (Setup, Patchnotes, Update, Settings)
│   ├── index.css                 # Theme variables, modal layering, responsive layout
│   ├── index.js                  # Frontend orchestration, IPC bridges, editor engine
│   ├── namumark.js               # Custom NamuMark parser & preview compiler
│   └── colors_data.js            # Character color mappings & metadata bundle
│
├── src-tauri/                    # DESKTOP RUNTIME (RUST / TAURI v1)
│   ├── Cargo.toml                # Rust manifest (Package: namu_vocaro_lyric v1.6.0)
│   ├── tauri.conf.json           # Tauri config (App ID, windows, security allowlist)
│   └── src/
│       └── main.rs               # IPC command handlers, DB initialization, process spawner
│
├── data/                         # APPLICATION DATA STORES
│   ├── colors.json               # Standard Vocaloid character colors
│   ├── colors_sekai.json         # Project SEKAI character colors
│   ├── colors_unit.json          # Project SEKAI unit/group colors
│   ├── config.json               # User preferences (theme, font, dev modes)
│   └── patchnotes.json           # Decoupled release notes database
│
├── 배포 폴더/                    # LOCAL RELEASE & DISTRIBUTION MIRROR
│   ├── NamuVocaroLyric.exe       # Shipped release binary
│   ├── namuvocarolyric_1.6.0_installer.exe # Standalone NSIS installer
│   └── data/patchnotes.json      # Mirror of patchnotes DB
│
└── updater/                      # ISOLATED LEGACY UPDATER (DO NOT TOUCH)
```

---

## 3. CRITICAL IMPLEMENTATION RULES & USER MANDATES

When developing in this codebase, any AI agent **MUST adhere to the following strict constraints**:

### Rule 1: Isolation of Legacy Updater Code
- The `updater/` directory contains legacy updater scripts and binaries. **NEVER modify, delete, or refactor code in `updater/`**. It is deliberately quarantined.

### Rule 2: Multi-Instance Process Self-Spawning (`open_new_window`)
- **Background**: Windows WebView2 experiences catastrophic graphic rendering lockups (white-screen freezes) when spawning multiple WebView windows within the same OS process.
- **Implementation**: The "New Lyrics (`📄 새 가사`)" button calls the Tauri IPC command `open_new_window`.
- **Rust Backend**:
  ```rust
  #[tauri::command]
  fn open_new_window() -> Result<(), String> {
      let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
      std::process::Command::new(current_exe).spawn().map_err(|e| e.to_string())?;
      Ok(())
  }
  ```
- **Rule**: Do NOT replace this with Tauri's in-process `WindowBuilder`. The standalone OS process architecture is mandatory for memory and session isolation.

### Rule 3: Dynamic Decoupled Patch Notes System (`data/patchnotes.json`)
- Patch notes must **NEVER be hardcoded inside JavaScript files**.
- The frontend fetches patch notes dynamically via `fetch('/api/patchnotes')`, which Tauri's backend intercepts to read `data/patchnotes.json`.
- **Parser Cleanliness**: When rendering NamuMark headings (`=== Header ===`) in patch notes, strip out automatic TOC hyperlinks (`<a href="#wiki-toc">1. </a>`) via regex before DOM insertion.
- **Layer Stacking (Z-Index)**:
  - Base Modals (`.modal-backdrop`): `z-index: 5000`
  - Patchnotes Modal (`#patchnotes-modal.modal-backdrop`): `z-index: 6000`
  - Confirm / Recovery Dialogs: `z-index: 6500` - `7000`
  - Toast Container (`.toast-container`): `z-index: 10000`
- **First-Run Trigger**:
  On startup, compare `localStorage.getItem('last_seen_patchnotes_version')` against `CURRENT_VERSION ("1.6.0")`. If mismatched, automatically pop open the patch notes modal at `z-index: 6000` above the startup setup dialog.

### Rule 4: GitHub Releases-based Update Checker (`checkForUpdates`)
- **API Target**: `https://api.github.com/repos/kangdol/NamuVocaroLyric/releases/latest`
- **Fallback Web Target**: `https://github.com/kangdol/NamuVocaroLyric/releases`
- **HTTP Allowlist**: `src-tauri/tauri.conf.json` includes `"https://api.github.com/**"` and `"https://github.com/**"` in `tauri.allowlist.http.scope`.
- **Query & Fallback Strategy**:
  1. Requests `releases/latest` JSON via GitHub REST API, extracts `tag_name` (stripping leading `v`), and resolves `.exe` installer asset URL or `html_url`.
  2. If the API fails (e.g. rate limit or network issue), falls back to scraping `https://github.com/kangdol/NamuVocaroLyric/releases` HTML with `/releases\/tag\/(?:v)?(\d+\.\d+\.\d+(?:\.\d+)?)/i`.
- **Semantic Integer Comparison**: Multi-digit versions (e.g., `1.5.10` vs `1.5.2`) are parsed numerically via `compareVersions()` by splitting `.` into integer arrays.
- **Modal UI Constraint**: The update modal (`#update-confirm-modal`) contains **ONLY** the `⬇️ 최신 버전 다운로드` button, `이번 버전 건너뛰기`, and `나중에 하기`. **Do NOT reintroduce any "배포 안내 페이지 보기" buttons**.

---

## 4. DUAL-TARGET ARCHITECTURE ROADMAP (WEB & DESKTOP)

The project is moving toward a **Single Codebase, Dual-Target** model (running as both a Windows Tauri App and a Static Web Application on GitHub Pages / Custom Domain).

### 4.1 Git Branching Strategy
- **Development Phase**: Create a feature branch (e.g. `feat/web-adapter`). Keep `main` stable.
- **Deployment / Release Phase**: Merge verified adapter code back into `main`. The unified codebase detects environment at runtime.

### 4.2 Platform Abstraction Layer (`platform.js` Design)
To support browser hosting without breaking desktop functionality:

```javascript
const Platform = {
    isTauri: () => typeof window.__TAURI__ !== 'undefined',
    
    // File Storage Adapter
    async saveLyrics(filename, content) {
        if (this.isTauri()) {
            return await window.__TAURI__.invoke('save_lyrics', { filename, content });
        } else {
            // Browser Web: Save to IndexedDB / LocalStorage
            localStorage.setItem(`lyrics_${filename}`, content);
            return true;
        }
    },
    
    async loadLyrics(filename) {
        if (this.isTauri()) {
            return await window.__TAURI__.invoke('load_lyrics', { filename });
        } else {
            return localStorage.getItem(`lyrics_${filename}`) || '';
        }
    },
    
    // Multi-Window Adapter
    openNewWindow() {
        if (this.isTauri()) {
            window.__TAURI__.invoke('open_new_window');
        } else {
            window.open(window.location.href, '_blank');
        }
    },
    
    // Update Checker Adapter
    checkUpdates() {
        if (this.isTauri()) {
            checkForUpdates(); // Desktop checks Namuwiki
        } else {
            // Web: Check ServiceWorker / Cache refresh
        }
    }
};
```

---

## 5. BUILD, COMPILATION, AND DEPLOYMENT PROCEDURES

### 5.1 Environment Prerequisites
- Node.js & npm
- Rust & Cargo (`rustc 1.70+`)
- Tauri CLI (`@tauri-apps/cli`)
- WiX Toolset (for `.msi` bundle generation)
- NSIS (`makensis.exe` in system PATH for `.exe` installer generation)

### 5.2 Build Command
Run from project root (`wonderful-pasteur/`):
```powershell
npm run tauri build
```

### 5.3 Output Artifact Locations
- **Standalone Binary**: `src-tauri/target/release/NamuVocaroLyric.exe`
- **NSIS Installer**: `src-tauri/target/release/bundle/nsis/NamuVocaroLyric_1.6.0_x64-setup.exe`
- **MSI Installer**: `src-tauri/target/release/bundle/msi/NamuVocaroLyric_1.6.0_x64_en-US.msi`

### 5.4 Mandatory Post-Build Synchronization
Whenever a new release build is compiled, the resulting binaries and `patchnotes.json` must be mirrored to:
1. `C:\Users\kangd\Desktop\테스트 폴더\`
2. `C:\Users\kangd\Documents\antigravity\wonderful-pasteur\배포 폴더\`

```powershell
# Synchronization Script Template:
taskkill /f /im NamuVocaroLyric.exe 2>$null
Copy-Item "src-tauri\target\release\NamuVocaroLyric.exe" "C:\Users\kangd\Desktop\테스트 폴더\NamuVocaroLyric.exe" -Force
Copy-Item "src-tauri\target\release\NamuVocaroLyric.exe" "배포 폴더\NamuVocaroLyric.exe" -Force
Copy-Item "src-tauri\target\release\bundle\nsis\NamuVocaroLyric_1.6.0_x64-setup.exe" "배포 폴더\namuvocarolyric_1.6.0_installer.exe" -Force
Copy-Item "data\patchnotes.json" "C:\Users\kangd\Desktop\테스트 폴더\data\patchnotes.json" -Force
Copy-Item "data\patchnotes.json" "배포 폴더\data\patchnotes.json" -Force
```

---

## 6. VERSION BUMP CHECKLIST
When incrementing the application version (e.g. from `1.5.1` to `1.5.2`):
1. `src-tauri/Cargo.toml`: `version = "X.X.X"`
2. `src-tauri/tauri.conf.json`: `"package.version": "X.X.X"`
3. `package.json` & `package-lock.json`: `"version": "X.X.X"`
4. `src/index.html`:
   - `#settings-version-link`: `버전 vX.X.X`
   - Cache-busting queries: `<script src="platform.js?v=X.X.X">`, `<script src="index.js?v=X.X.X">`
5. `src/index.js`:
   - `CURRENT_VERSION = "X.X.X"` in `checkFirstRunPatchnotes()`
6. `data/patchnotes.json`:
   - Add new release entry object at index 0 of the array.
   - Use channel prefix tags: `[공통]`, `[웹]`, `[데스크톱]` in change descriptions.
7. **Relative Paths & CORS Check**:
   - Ensure all new assets use relative paths (`data/...`, not `/data/...`).
   - Guard desktop-only HTTP fetches with `if (Platform.isTauri())`.
