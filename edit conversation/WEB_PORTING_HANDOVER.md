# SYSTEM INSTRUCTION & DIRECTIVE: WEB PLATFORM ADAPTER FOR NAMUVOCAROLYRIC

> **TO**: AI Lead Engineer & Architect (Author of `AI_DEVELOPER_GUIDE.md` & `WEB_PORTING_SPEC.md`)  
> **FROM**: AI System Analyst  
> **PROJECT**: NamuVocaroLyric (나무보카로가사) v1.5.1  
> **CONTEXT**: Resuming Web Porting Implementation (GitHub Pages Static Hosting)  
> **TARGET DIRECTORY**: `C:\Users\kangd\Documents\antigravity\wonderful-pasteur`  

---

## 1. USER DECISION INVARIANTS & CONSTRAINTS

The project owner has reviewed the porting plan and made the following **authoritative decisions**:

1. **NO Suffix File Forking (`_web` prefix/suffix rejected)**:
   - Do **NOT** duplicate `index.html`, `index.js`, or `index.css` with `_web` suffixes.
   - Maintain a **Strict Single Codebase (Dual-Target Hybrid)** architecture.
   - Both Desktop (`.exe` / Tauri) and Web (Browser / GitHub Pages) must run off the same core files via runtime platform detection (`typeof window.__TAURI__ !== 'undefined'`).

2. **Web Font CDN Migration (Drop heavy local binaries)**:
   - Do **NOT** serve the ~10MB+ local font binaries (`src/fonts/*.woff2`) over GitHub Pages.
   - Switch to **Web Font CDNs** (Google Fonts for Noto Sans/Serif KR, Nanum Gothic; jsDelivr for Pretendard JP, Maru Buri, Nanum Barun Gothic).
   - In `src/index.css`, retain `local(...)` definitions first so that desktop or locally installed fonts are honored with zero network overhead.

3. **Exclude Drag-and-Drop File Import**:
   - Do **NOT** implement editor Drag-and-Drop file handling for lyrics.
   - Retain only explicit modal actions: **"Open File from PC (`.txt` File Picker)"** and **"Export to PC (`.txt` Blob Download)"**.

4. **Preserve Desktop Runtime Integrity**:
   - `updater/` directory remains strictly quarantined. Do not modify or delete.
   - Multi-process spawning (`open_new_window` in Rust) for Desktop WebView2 stability must remain intact.
   - Text immutability for lyrics must be strictly honored (no autocorrecting typos/mondegreens).

---

## 2. ARCHITECTURAL FINDINGS & CRITICAL SPEC OMISSIONS

Upon deep analysis of `WEB_PORTING_SPEC.md` against `src/index.js` (4,446 lines) and `src-tauri/src/main.rs`, the following critical items were **omitted in the original RFC-002** and **MUST be addressed**:

### Omission A: Custom Character DB CRUD Was Missing
- In desktop mode, Tauri saves custom characters to `data/custom_colors*.json` and merges them with pure vanilla DBs (`deleted: true` markers override built-ins).
- In Web mode, this must be persisted in `localStorage` under `nvl_custom_colors_{standard|sekai|unit}` and merged identically to Rust's `load_character_db`, `save_character`, and `delete_character`.

### Omission B: User Configuration Persistence Was Missing
- `/api/config` and `/api/save-config` persist theme, font, pure-black, and tab settings.
- In Web mode, these must read/write to `localStorage.getItem('nvl_config')`.

### Omission C: Non-Invasive Adapter Strategy via Fetch Interception (RECOMMENDED)
- Instead of refactoring dozens of call sites across `src/index.js`, **`src/platform.js` should intercept `window.fetch` when running in Web mode (`Platform.isWeb()`)**.
- Tauri already uses this exact pattern (`if (window.__TAURI__) { window.fetch = ... }`).
- By mounting a Web Virtual Storage Fetch Interceptor when `!window.__TAURI__`, **`src/index.js` requires virtually zero invasive modifications**.

---

## 3. IMPLEMENTATION SPECIFICATION (`src/platform.js`)

Create `src/platform.js` loaded before `colors_data.js` and `index.js` in `src/index.html`.

```javascript
/**
 * src/platform.js - Unified Platform Abstraction & Virtual Web Storage Engine
 */
const Platform = {
    isTauri: () => typeof window.__TAURI__ !== 'undefined',
    isWeb: () => typeof window.__TAURI__ === 'undefined',

    // --- Web Virtual Storage Store ---
    storage: {
        // 1. Lyrics Management
        async saveLyrics(filename, content) {
            const cleanName = filename.replace(/\.txt$/i, '').trim() || 'lyrics';
            const fullName = `${cleanName}.txt`;
            const store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const mtime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            
            store[fullName] = {
                name: fullName,
                content: content,
                mtime: mtime,
                size: new Blob([content]).size
            };
            localStorage.setItem('nvl_lyrics_files', JSON.stringify(store));

            // Clean up autosave upon explicit save
            if (fullName !== '_autosave.txt') {
                delete store['_autosave.txt'];
                localStorage.setItem('nvl_lyrics_files', JSON.stringify(store));
            }

            return { status: 'success', filename: fullName, path: 'localStorage' };
        },

        async loadLyrics(filename) {
            const store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
            const cleanName = filename.replace(/\.txt$/i, '').trim();
            const key = store[filename] ? filename : `${cleanName}.txt`;
            if (store[key]) {
                return { status: 'success', content: store[key].content, filename: key };
            }
            return { status: 'error', content: '', filename };
        },

        async listLyrics() {
            const store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
            return Object.values(store).sort((a, b) => (b.mtime || '').localeCompare(a.mtime || ''));
        },

        async deleteLyrics(filename) {
            const store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
            const cleanName = filename.replace(/\.txt$/i, '').trim();
            delete store[filename];
            delete store[`${cleanName}.txt`];
            localStorage.setItem('nvl_lyrics_files', JSON.stringify(store));
            return { status: 'success' };
        },

        // 2. Physical File I/O
        exportLocalFile(filename, content) {
            const cleanName = filename.replace(/\.txt$/i, '').trim() || 'lyrics';
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${cleanName}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        triggerLocalFileInput(callback) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,text/plain';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const text = evt.target.result;
                    const name = file.name.replace(/\.txt$/i, '');
                    callback(name, text);
                };
                reader.readAsText(file);
            };
            input.click();
        },

        // 3. Character DB Custom Storage & Merge
        loadCharacterDb(category) {
            let base = {};
            if (category === 'sekai' && typeof DEFAULT_COLORS_SEKAI !== 'undefined') base = { ...DEFAULT_COLORS_SEKAI };
            else if (category === 'unit' && typeof DEFAULT_COLORS_UNIT !== 'undefined') base = { ...DEFAULT_COLORS_UNIT };
            else if (typeof DEFAULT_COLORS_STD !== 'undefined') base = { ...DEFAULT_COLORS_STD };

            const custom = JSON.parse(localStorage.getItem(`nvl_custom_${category}`) || '{}');
            Object.keys(custom).forEach(name => {
                if (custom[name].deleted) {
                    delete base[name];
                } else {
                    base[name] = custom[name];
                }
            });
            return base;
        },

        saveCharacter({ category, isEdit, origName, name, color1, color2, aliases }) {
            const key = `nvl_custom_${category}`;
            const custom = JSON.parse(localStorage.getItem(key) || '{}');
            if (isEdit && origName && origName !== name) {
                custom[origName] = { deleted: true };
            }
            custom[name] = {
                color_1: color1,
                color_2: color2,
                aliases: aliases || [],
                deleted: false,
                custom_type: 'modified'
            };
            localStorage.setItem(key, JSON.stringify(custom));
            return { status: 'success' };
        },

        deleteCharacter({ category, name }) {
            const key = `nvl_custom_${category}`;
            const custom = JSON.parse(localStorage.getItem(key) || '{}');
            custom[name] = { deleted: true };
            localStorage.setItem(key, JSON.stringify(custom));
            return { status: 'success' };
        },

        // 4. Config
        loadConfig() {
            return JSON.parse(localStorage.getItem('nvl_config') || '{}');
        },
        saveConfig(cfg) {
            localStorage.setItem('nvl_config', JSON.stringify(cfg));
            return { status: 'saved' };
        }
    },

    // --- Window & Navigation Adapters ---
    openNewWindow() {
        if (Platform.isTauri()) {
            window.__TAURI__.invoke('open_new_window');
        } else {
            window.open(window.location.origin + window.location.pathname, '_blank');
        }
    },

    openExternalUrl(url) {
        if (Platform.isTauri() && window.__TAURI__.shell) {
            window.__TAURI__.shell.open(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    },

    initUpdateChecker(checkerFn) {
        if (Platform.isTauri()) {
            checkerFn();
        } else {
            console.log("[Platform] Running in browser environment. Auto-update check skipped.");
        }
    },

    registerUnloadGuard(hasUnsavedChangesFn) {
        if (Platform.isWeb()) {
            window.addEventListener('beforeunload', (e) => {
                if (hasUnsavedChangesFn()) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
        }
    }
};

// Global Fetch Interception for Web Environment
if (Platform.isWeb()) {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        const urlStr = typeof url === 'string' ? url : (url.url || String(url));
        const respond = (data) => Promise.resolve({
            ok: true,
            status: 200,
            json: async () => data,
            text: async () => JSON.stringify(data)
        });

        if (urlStr === '/api/config') return respond(Platform.storage.loadConfig());
        if (urlStr === '/api/save-config') {
            return respond(Platform.storage.saveConfig(JSON.parse(options.body || '{}')));
        }
        if (urlStr === '/colors.json') return respond(Platform.storage.loadCharacterDb('standard'));
        if (urlStr === '/colors_sekai.json') return respond(Platform.storage.loadCharacterDb('sekai'));
        if (urlStr === '/colors_unit.json') return respond(Platform.storage.loadCharacterDb('unit'));
        if (urlStr === '/api/save') {
            return respond(Platform.storage.saveCharacter(JSON.parse(options.body || '{}')));
        }
        if (urlStr === '/api/delete') {
            return respond(Platform.storage.deleteCharacter(JSON.parse(options.body || '{}')));
        }
        if (urlStr === '/api/save-lyrics') {
            const body = JSON.parse(options.body || '{}');
            return respond(await Platform.storage.saveLyrics(body.filename, body.content));
        }
        if (urlStr === '/api/list-lyrics') return respond(await Platform.storage.listLyrics());
        if (urlStr.startsWith('/api/load-lyrics')) {
            const params = new URLSearchParams(urlStr.split('?')[1] || '');
            return respond(await Platform.storage.loadLyrics(params.get('file') || ''));
        }
        if (urlStr === '/api/delete-lyrics') {
            const body = JSON.parse(options.body || '{}');
            return respond(await Platform.storage.deleteLyrics(body.filename));
        }
        if (urlStr === '/api/patchnotes' || urlStr.includes('patchnotes.json')) {
            try {
                return await originalFetch('data/patchnotes.json');
            } catch {
                return respond([]);
            }
        }
        if (urlStr === '/sample.json' || urlStr.includes('sample.json')) {
            try {
                return await originalFetch('sample.json');
            } catch {
                return respond({ activeCharacters: ["하츠네 미쿠"], lyrics: "" });
            }
        }
        if (urlStr === '/api/log-text' || urlStr === '/api/log-error' || urlStr === '/api/force-exit' || urlStr === '/api/exit-app') {
            return respond({ status: 'ok' });
        }

        return originalFetch.apply(this, arguments);
    };
}

window.Platform = Platform;
```

---

## 4. UI HOOKS & COMPATIBILITY CHECKLIST

1. **`src/index.html` Modifications**:
   - Add `<script src="platform.js"></script>` before `colors_data.js`.
   - Add Google Fonts / CDN links for:
     - `Noto Sans KR`, `Noto Serif KR`, `Nanum Gothic` via Google Fonts.
     - `Pretendard JP` via jsDelivr: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-jp.min.css`.
   - In `#lyrics-load-modal`, inject:
     - Button: `<button id="btn-import-pc-lyrics" class="btn btn-secondary">💻 내 컴퓨터 파일 열기</button>`
     - In file table rows, add an Export button: `<button class="export-file-btn" title="내 컴퓨터로 다운로드">💾</button>`

2. **`src/index.css` Modifications**:
   - Ensure `@font-face` blocks specify `local(...)` first, followed by relative `fonts/...` paths (strip leading `/` to prevent 404s on GitHub Pages sub-paths).

3. **Automation & CI/CD**:
   - Implement `.github/workflows/deploy_pages.yml` uploading `src/` and `data/` as static artifacts.
