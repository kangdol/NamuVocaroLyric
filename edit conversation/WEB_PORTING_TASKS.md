# ACTION ITEMS & IMPLEMENTATION ROADMAP FOR WEB PORTING SESSION

> **TO**: AI System Analyst & Web Porting Session (`feat/web-adapter`)  
> **FROM**: AI Lead Architect & Desktop Core Session (`master`)  
> **PROJECT**: NamuVocaroLyric (나무보카로가사)  
> **VERSION STATUS**: v1.6.0 Released & Synchronized  
> **LOCATION**: `C:\Users\kangd\Documents\antigravity\wonderful-pasteur\edit conversation\WEB_PORTING_TASKS.md`  
> **DATE**: 2026-10-06  

---

## 1. DESKTOP SESSION STATUS UPDATE

- **Version 1.6.0 Bump Completed**:
  - `Cargo.toml`, `tauri.conf.json`, `package.json`, `package-lock.json`, `index.html`, `index.js` all unified at `1.6.0`.
  - `data/patchnotes.json` index 0 updated with `[공통] 웹 서비스 대응`.
  - Production release binary compilation (`npm run tauri build`) passed 100% cleanly.
  - Release binaries deployed to `배포 폴더/` and Desktop `테스트 폴더/`.
- **Master Branch Status**: Clean, green, build-ready, and waiting for web adapter integration.

---

## 2. WEB PORTING ACTION ITEMS & SPECIFICATIONS

The user has explicitly requested that the web porting session handle the frontend adaptation for web service operation. Here are the prioritized tasks and architecture specifications to implement on your branch:

### Task 1: Core Platform Adapter (`src/platform.js`)
Create `src/platform.js` and inject it as the **first script** in `src/index.html` (`<script src="platform.js?v=1.6.0"></script>` before `colors_data.js`).

1. **Environment Detection**:
   ```javascript
   const Platform = {
       isTauri: () => typeof window !== 'undefined' && Boolean(window.__TAURI__),
       isWeb: () => !Platform.isTauri(),
       // ...
   };
   ```
2. **Virtual File Storage Interface (`Platform.storage`)**:
   - `readText(relativePath, fallbackDefault = null)`:
     - **Desktop**: Calls Tauri `fs.readTextFile(relativePath)` or IPC.
     - **Web**: Reads from `localStorage.getItem(relativePath)`. If null, performs relative `fetch(relativePath)` to load bundled JSON defaults (`data/colors.json`, `data/patchnotes.json`), then caches into `localStorage`.
   - `writeText(relativePath, contentString)`:
     - **Desktop**: Calls Tauri `fs.writeTextFile(relativePath, contentString)`.
     - **Web**: Writes to `localStorage.setItem(relativePath, contentString)` with quota-exceeded try/catch safety.
   - `exists(relativePath)`:
     - Checks existence on disk (Tauri) or in `localStorage` (Web).
3. **File Open / Save Dialog Interface (`Platform.dialog`)**:
   - `openFile(options)`:
     - **Desktop**: Uses Tauri `window.__TAURI__.dialog.open()`.
     - **Web**: Triggers invisible `<input type="file" accept=".txt,.json,.lrc">` and reads `FileReader`.
   - `saveFile(content, defaultFilename, mimeType)`:
     - **Desktop**: Uses Tauri `window.__TAURI__.dialog.save()`.
     - **Web**: Triggers browser Blob download via temporary `<a download="..." href="URL.createObjectURL(blob)">`.

---

### Task 2: Web Distribution & PC App Download Integration (User Requirement)
The user requested integrating the PC distribution and update flow into the web service.

1. **Web UI Download Button**:
   - On web mode (`Platform.isWeb()`), add a prominent **"💻 PC 데스크톱 버전 다운로드 (v1.6.0)"** button/modal link (in the settings modal or main navbar).
   - This points users to the standalone installer hosted on GitHub Releases:
     `https://github.com/<owner>/<repo>/releases/latest/download/namuvocarolyric_1.6.0_installer.exe`
2. **Unified Data Provider for Updates**:
   - Ensure `data/patchnotes.json` is deployed cleanly as a static web asset under GitHub Pages.
   - Future desktop versions can query `https://<owner>.github.io/<repo>/data/patchnotes.json` directly, eliminating fragile Namuwiki HTML scraping.

---

### Task 3: Web Font Fallback (Zero-Local-Font Dependency)
- Desktop relies on local/installed fonts (e.g. NanumGothic, Noto Sans KR, Pretendard).
- For web mode:
  - Add Google Fonts / Noto Sans KR CDN link in `src/index.html` head.
  - In `src/index.css`, ensure font-family stacks degrade gracefully:
    `font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;`

---

### Task 4: Graceful Degradation of Desktop-Only Features
Wrap desktop-specific operations behind `if (Platform.isTauri())`:
1. **Window Controls**:
   - Minimize, Maximize, Close buttons in header (`#btn-window-min`, `#btn-window-max`, `#btn-window-close`) must be hidden on web (`display: none`).
2. **Desktop Drag & Drop IPC**:
   - Guard `window.__TAURI__.event.listen('tauri://file-drop', ...)` to prevent runtime crashes in browser.
   - In web mode, implement standard HTML5 `dragover` / `drop` event listeners on `#editor-textarea` to read dropped text files via `DataTransferItemList`.
3. **External Window Spawning**:
   - Operations that spawn a child Tauri window (like detached preview) should fallback to `window.open()` or tab-based preview on web.

---

### Task 5: GitHub Pages CI/CD Workflow (`.github/workflows/deploy_pages.yml`)
Establish an automated GitHub Action to build and deploy static assets to GitHub Pages:
- Static build output directory: `src/` (or artifact staging containing `src/`, `data/`).
- Verify that all asset paths in HTML/JS/CSS are relative (no leading `/`) so they work smoothly under GitHub Pages repository sub-paths (`https://<user>.github.io/<repo>/`).

---

## 3. STRICT CONSTRAINTS REMINDER

1. **Strict Single Codebase Invariant**:
   - **Do NOT create separate HTML files** (`index_web.html`, etc.).
   - All logic branching must be handled dynamically at runtime via `Platform.isTauri()` / `Platform.isWeb()`.
2. **Quarantine `updater/`**:
   - Never touch or modify the `updater/` folder.
3. **Text Integrity**:
   - Preserve original lyrics markup and syntax rules exactly as specified in `AI_DEVELOPER_GUIDE.md`.

---

Please proceed with implementing the web adapter according to this roadmap and notify the main session when ready for integration testing.
