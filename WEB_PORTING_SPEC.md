# TECHNICAL SPECIFICATION & RFC: WEB PLATFORM ADAPTER FOR NAMUVOCAROLYRIC

> **DOCUMENT ID**: RFC-002-WEB-PORTING  
> **TARGET**: AI Engineering Agents, LLM Developers, and Contributors  
> **PRIMARY REPO**: `C:\Users\kangd\Documents\antigravity\wonderful-pasteur`  
> **SCOPE**: Single Codebase, Dual-Target Architecture (Desktop Tauri .exe ⟷ Web Browser / GitHub Pages)  
> **BRANCH TARGET**: `feat/web-adapter`  

---

## 1. EXECUTIVE SUMMARY & OBJECTIVE

### 1.1 Objective
Port the desktop application **NamuVocaroLyric (나무보카로가사)** to run natively inside modern web browsers (specifically hosted on **GitHub Pages** or custom domains) **WITHOUT breaking or duplicating the desktop codebase**. 

### 1.2 Core Architectural Principle (Single Source of Truth)
Do **NOT** fork the repository into two separate divergent projects. Maintain a single codebase where **95% of core assets are 100% shared**, and the remaining **5% platform-dependent operations** are abstracted behind a unified **Platform Adapter Pattern (`platform.js`)**.

---

## 2. INVARIANT CORE ASSETS (DO NOT RE-IMPLEMENT OR TOUCH)

The following components are **already fully production-ready and cross-platform compatible**:

1. **Responsive Mobile/Tablet UI**:
   - Location: `src/index.css` (Lines 1839–1950, `@media (max-width: 768px)`).
   - Features: Automatic vertical stacking of editor and preview panes, responsive headers, auto-wrapping buttons, full modal scaling (95% viewport). **No UI redesign is needed for mobile/tablet**.
2. **NamuMark Parsing & Rendering Engine**:
   - Location: `src/namumark.js`.
   - Pure client-side JavaScript converting raw lyric stanzas into Namuwiki table syntax (`||<bgcolor=...> ... ||`).
3. **Character Palette & Metadata System**:
   - Location: `src/colors_data.js`, `data/colors.json`, `data/colors_sekai.json`, `data/colors_unit.json`.
4. **Editor Features & Syntax Highlighting**:
   - Dynamic autocomplete, multi-voice bracket parsing, color tags, shortcuts (`Ctrl+S`, `Ctrl+B`), dark/pure-black themes.

---

## 3. PLATFORM DIFFERENTIAL ANALYSIS MATRIX

There are **strictly 4 functional discrepancies** between Desktop (Tauri) and Web (Browser):

| Category | 🖥️ Desktop Runtime (Tauri / .exe) | 🌐 Web Browser Runtime (GitHub Pages) |
| :--- | :--- | :--- |
| **1. File Storage & I/O** | Native disk writes to `lyrics/*.txt` via Tauri IPC (`fs` commands). | Sandboxed browser storage (**IndexedDB / LocalStorage**) + **Blob File Download/Upload**. |
| **2. Multi-Window / New Song** | Spawns a separate OS process via `open_new_window` (`std::process::Command::spawn`). | Opens a clean session in a new browser tab (`window.open(window.location.href, '_blank')`). |
| **3. Update Checking** | Scrapes Namuwiki (`https://namu.wiki/w/사용자:kangdoi`) ➡️ pops installer download modal. | **Disabled/Hidden** (Web is always running the latest live assets; optional reload toast). |
| **4. Exit / Window Close Guard** | Tauri IPC `onCloseRequested` intercept ➡️ custom modal `#close-confirm-modal`. | Standard browser `window.addEventListener('beforeunload')` event. |

---

## 4. ARCHITECTURAL DESIGN: `platform.js`

To decouple the UI from Tauri, introduce `src/platform.js`. All platform-specific branching must route through this object.

```javascript
/**
 * src/platform.js - Unified Platform Abstraction Layer
 */
const Platform = {
    // 1. Environment Detection
    isTauri: () => typeof window.__TAURI__ !== 'undefined',
    isWeb: () => typeof window.__TAURI__ === 'undefined',

    // 2. Storage & File I/O
    storage: {
        async saveLyrics(songTitle, content) {
            if (Platform.isTauri()) {
                return await fetch('/api/save-lyrics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: songTitle, content })
                }).then(r => r.ok);
            } else {
                // Web: Save to IndexedDB or LocalStorage
                try {
                    localStorage.setItem(`nvl_song_${songTitle}`, content);
                    // Maintain a list of saved songs
                    const songs = JSON.parse(localStorage.getItem('nvl_song_list') || '[]');
                    if (!songs.includes(songTitle)) {
                        songs.push(songTitle);
                        localStorage.setItem('nvl_song_list', JSON.stringify(songs));
                    }
                    return true;
                } catch (e) {
                    console.error("Web storage quota exceeded or failed:", e);
                    return false;
                }
            }
        },

        async loadLyrics(songTitle) {
            if (Platform.isTauri()) {
                const res = await fetch(`/api/load-lyrics?file=${encodeURIComponent(songTitle)}`);
                if (res.ok) {
                    const data = await res.json();
                    return data.content || '';
                }
                return '';
            } else {
                // Web: Read from LocalStorage
                return localStorage.getItem(`nvl_song_${songTitle}`) || '';
            }
        },

        async listLyrics() {
            if (Platform.isTauri()) {
                const res = await fetch('/api/lyrics');
                if (res.ok) return await res.json();
                return [];
            } else {
                // Web: Return song list from LocalStorage
                return JSON.parse(localStorage.getItem('nvl_song_list') || '[]');
            }
        },

        // Web Exclusive: Export file to physical disk via Browser Download
        exportLocalFile(filename, content) {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        // Web Exclusive: Import physical .txt file via File Picker
        triggerLocalFileInput(onLoaded) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,text/plain';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target.result;
                    const cleanName = file.name.replace(/\.txt$/i, '');
                    onLoaded(cleanName, content);
                };
                reader.readAsText(file);
            };
            input.click();
        }
    },

    // 3. Multi-Window / New Song Orchestration
    openNewWindow() {
        if (Platform.isTauri()) {
            window.__TAURI__.invoke('open_new_window');
        } else {
            // Web: Open fresh editor instance in new browser tab
            window.open(window.location.origin + window.location.pathname, '_blank');
        }
    },

    // 4. External URL Navigation
    openExternalUrl(url) {
        if (Platform.isTauri() && window.__TAURI__.shell) {
            window.__TAURI__.shell.open(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    },

    // 5. Update Checker Guard
    initUpdateChecker(checkerFn) {
        if (Platform.isTauri()) {
            checkerFn(); // Only desktop checks Namuwiki installer updates
        } else {
            console.log("[Platform] Web mode active: skipping desktop installer update check.");
        }
    },

    // 6. Window Close Guard
    registerUnloadGuard(hasUnsavedChangesFn) {
        if (Platform.isWeb()) {
            window.addEventListener('beforeunload', (e) => {
                if (hasUnsavedChangesFn()) {
                    e.preventDefault();
                    e.returnValue = ''; // Standard browser exit prompt
                }
            });
        }
    }
};

window.Platform = Platform;
```

---

## 5. REFACTORING & CODE MODIFICATION PLAN

### Step 1: Create Feature Branch
```powershell
git checkout -b feat/web-adapter
```

### Step 2: Inject `platform.js` into HTML
In `src/index.html`:
```html
<!-- Script Injection -->
<script src="platform.js"></script>
<script src="colors_data.js?v=1.5.1"></script>
<script src="namumark.js?v=1.5.1"></script>
<script src="index.js?v=1.5.1"></script>
```

### Step 3: Replace Direct Tauri Calls in `src/index.js`
1. **Save / Load / List**:
   - Replace direct `fetch('/api/save-lyrics')` with `Platform.storage.saveLyrics()`.
   - In Web mode, provide UI options:
     - "임시 보관 (In-Browser)" 
     - "내 컴퓨터로 저장 (.txt 다운로드)"
2. **New Lyrics Button (`📄 새 가사`)**:
   - In `initNewLyricsButton()`:
     Replace `window.__TAURI__.invoke('open_new_window')` with `Platform.openNewWindow()`.
3. **Auto Update Checker Call**:
   - Wrap `checkForUpdates()` call at bottom of `DOMContentLoaded` with:
     ```javascript
     Platform.initUpdateChecker(() => checkForUpdates());
     ```
4. **Exit Confirmation**:
   - In `initExitConfirmModal()`:
     Wrap Tauri close listener with `if (Platform.isTauri())`, and register `Platform.registerUnloadGuard(() => isUserEditingStarted)`.

---

## 6. GITHUB PAGES DEPLOYMENT SETUP

### 6.1 Static Asset Structure for Web
GitHub Pages requires web files to be served either from the repository root `/` or from a `/docs` directory.
Since the app's frontend lives in `src/`, a lightweight build script or symbolic bundle can export `src/` to `docs/`:

```powershell
# Web Build Script (scripts/build_web.ps1)
Remove-Item -Path "docs" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "docs" | Out-Null
Copy-Item "src\*" -Destination "docs\" -Recurse -Force
Copy-Item "data\patchnotes.json" -Destination "docs\data\patchnotes.json" -Force -ErrorAction SilentlyContinue
Copy-Item "data\colors*.json" -Destination "docs\data\" -Force -ErrorAction SilentlyContinue
Write-Host "Web distribution ready in /docs"
```

### 6.2 GitHub Actions Automated Deployment (`.github/workflows/deploy_pages.yml`)
```yaml
name: Deploy Web Version to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Prepare Artifacts
        run: |
          mkdir public
          cp -r src/* public/
          mkdir -p public/data
          cp data/*.json public/data/
      - name: Upload Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'public'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 7. VERIFICATION & TEST CRITERIA

Before merging `feat/web-adapter` into `main`, verify all matrix conditions:

- [ ] **Web Browser Test (Chrome / Edge / Firefox)**:
  - Opening `src/index.html` via local HTTP server (`npx serve src` or python http.server) loads without console errors.
  - Creating a song and saving writes to `IndexedDB/LocalStorage`.
  - Exporting downloads a `.txt` file with accurate UTF-8 encoding.
  - Clicking `📄 새 가사` opens a new browser tab with clean initial state.
  - Update check popup does NOT trigger on web.
  - Responsive layout collapses gracefully on viewport < 768px.
- [ ] **Desktop Regression Test (.exe / Tauri)**:
  - Running `npm run tauri build` succeeds without compiler warnings.
  - Generated `NamuVocaroLyric.exe` still writes directly to disk `lyrics/` folder.
  - `open_new_window` continues to spawn an isolated OS process.
  - Namuwiki update checker triggers normally on desktop.
