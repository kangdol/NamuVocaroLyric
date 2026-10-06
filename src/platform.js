/**
 * src/platform.js
 * Unified Platform Abstraction Layer & Virtual Web Storage Engine
 * NamuVocaroLyric v1.6.0
 */

(function() {
    'use strict';

    const Platform = {
        // 1. Environment Queries
        isTauri: () => typeof window !== 'undefined' && Boolean(window.__TAURI__),
        isWeb: () => !Platform.isTauri(),

        // 2. Storage & Preferences (Generic File / Text API)
        storage: {
            /**
             * Reads text or JSON data from storage.
             * @param {string} relativePath e.g. "data/colors.json", "config.json"
             * @param {string|null} defaultFallback
             * @returns {Promise<string>}
             */
            async readText(relativePath, defaultFallback = null) {
                if (Platform.isTauri()) {
                    try {
                        return await window.__TAURI__.fs.readTextFile(relativePath);
                    } catch (e) {
                        return defaultFallback;
                    }
                } else {
                    const cleanPath = relativePath.replace(/^\/+/, '');
                    const cached = localStorage.getItem(cleanPath);
                    if (cached !== null) return cached;

                    try {
                        const resp = await fetch(cleanPath);
                        if (resp.ok) {
                            const text = await resp.text();
                            localStorage.setItem(cleanPath, text);
                            return text;
                        }
                    } catch (_) {}

                    return defaultFallback;
                }
            },

            /**
             * Writes text or JSON data to storage.
             * @param {string} relativePath
             * @param {string} contentString
             * @returns {Promise<boolean>}
             */
            async writeText(relativePath, contentString) {
                if (Platform.isTauri()) {
                    await window.__TAURI__.fs.writeTextFile(relativePath, contentString);
                    return true;
                } else {
                    const cleanPath = relativePath.replace(/^\/+/, '');
                    try {
                        localStorage.setItem(cleanPath, contentString);
                        return true;
                    } catch (e) {
                        console.warn("[Platform.storage] Quota exceeded or storage error:", e);
                        if (typeof showToast === 'function') {
                            showToast("브라우저 저장 공간이 가득 찼습니다. 가사를 .txt 파일로 다운로드하여 백업해 주세요.", 'danger-user');
                        }
                        return false;
                    }
                }
            },

            // --- Specialized Web Storage Handlers for Lyrics ---
            async saveLyrics(filename, content) {
                const cleanName = filename.replace(/\.txt$/i, '').trim() || 'lyrics';
                const fullName = `${cleanName}.txt`;
                let store = {};
                try {
                    store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
                } catch (_) {
                    store = {};
                }

                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const mtime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

                store[fullName] = {
                    name: fullName,
                    content: content,
                    mtime: mtime,
                    size: new Blob([content]).size
                };

                try {
                    localStorage.setItem('nvl_lyrics_files', JSON.stringify(store));
                } catch (e) {
                    console.warn("[Platform.storage] Quota exceeded when saving lyrics:", e);
                    if (typeof showToast === 'function') {
                        showToast("브라우저 저장 공간이 부족합니다! 가사를 PC로 다운로드하여 저장해 주세요.", 'danger-user');
                    }
                    return { status: 'error', message: 'Quota exceeded' };
                }

                // If saving a formal file, delete temporary autosave
                if (fullName !== '_autosave.txt') {
                    delete store['_autosave.txt'];
                    try {
                        localStorage.setItem('nvl_lyrics_files', JSON.stringify(store));
                    } catch (_) {}
                }

                return {
                    status: 'success',
                    filename: fullName,
                    path: 'localStorage'
                };
            },

            async loadLyrics(filename) {
                let store = {};
                try {
                    store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
                } catch (_) {
                    store = {};
                }

                const cleanName = filename.replace(/\.txt$/i, '').trim();
                const targetKey = store[filename] ? filename : (store[`${cleanName}.txt`] ? `${cleanName}.txt` : null);

                if (targetKey && store[targetKey]) {
                    return {
                        status: 'success',
                        content: store[targetKey].content || '',
                        filename: targetKey
                    };
                }

                return {
                    status: 'error',
                    content: '',
                    filename: filename
                };
            },

            async listLyrics() {
                let store = {};
                try {
                    store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
                } catch (_) {
                    store = {};
                }

                return Object.values(store).sort((a, b) => {
                    const timeA = a.mtime || '';
                    const timeB = b.mtime || '';
                    return timeB.localeCompare(timeA);
                });
            },

            async deleteLyrics(filename) {
                let store = {};
                try {
                    store = JSON.parse(localStorage.getItem('nvl_lyrics_files') || '{}');
                } catch (_) {
                    store = {};
                }

                const cleanName = filename.replace(/\.txt$/i, '').trim();
                delete store[filename];
                delete store[`${cleanName}.txt`];

                try {
                    localStorage.setItem('nvl_lyrics_files', JSON.stringify(store));
                } catch (_) {}

                return { status: 'success' };
            },

            // --- Character DB Custom Storage & Merge ---
            loadCharacterDb(category) {
                let base = {};
                if (category === 'sekai' && typeof DEFAULT_COLORS_SEKAI !== 'undefined') {
                    base = JSON.parse(JSON.stringify(DEFAULT_COLORS_SEKAI));
                } else if (category === 'unit' && typeof DEFAULT_COLORS_UNIT !== 'undefined') {
                    base = JSON.parse(JSON.stringify(DEFAULT_COLORS_UNIT));
                } else if (typeof DEFAULT_COLORS_STD !== 'undefined') {
                    base = JSON.parse(JSON.stringify(DEFAULT_COLORS_STD));
                }

                const customKey = `nvl_custom_${category}`;
                let custom = {};
                try {
                    custom = JSON.parse(localStorage.getItem(customKey) || '{}');
                } catch (_) {
                    custom = {};
                }

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
                const customKey = `nvl_custom_${category}`;
                let custom = {};
                try {
                    custom = JSON.parse(localStorage.getItem(customKey) || '{}');
                } catch (_) {
                    custom = {};
                }

                if (isEdit && origName && origName !== name) {
                    custom[origName] = { deleted: true };
                }

                custom[name] = {
                    color_1: color1 || {},
                    color_2: color2 || {},
                    aliases: aliases || [],
                    deleted: false,
                    custom_type: 'modified'
                };

                try {
                    localStorage.setItem(customKey, JSON.stringify(custom));
                } catch (e) {
                    console.warn("[Platform.storage] Failed to save custom character:", e);
                }
                return { status: 'success' };
            },

            deleteCharacter({ category, name }) {
                const customKey = `nvl_custom_${category}`;
                let custom = {};
                try {
                    custom = JSON.parse(localStorage.getItem(customKey) || '{}');
                } catch (_) {
                    custom = {};
                }

                custom[name] = { deleted: true };
                try {
                    localStorage.setItem(customKey, JSON.stringify(custom));
                } catch (_) {}

                return { status: 'success' };
            },

            // --- Configuration Storage ---
            loadConfig() {
                try {
                    return JSON.parse(localStorage.getItem('nvl_config') || '{}');
                } catch (_) {
                    return {};
                }
            },

            saveConfig(cfg) {
                try {
                    localStorage.setItem('nvl_config', JSON.stringify(cfg));
                } catch (_) {}
                return { status: 'saved' };
            }
        },

        // 3. File Open & Save Dialogs
        dialog: {
            /**
             * Opens a file picker dialog and returns the file text and filename.
             * @param {Object} options { extensions: ['txt', 'json', 'lrc'] }
             * @returns {Promise<{ filename: string, content: string } | null>}
             */
            async openFile(options = {}) {
                if (Platform.isTauri()) {
                    if (window.__TAURI__ && window.__TAURI__.dialog) {
                        const selected = await window.__TAURI__.dialog.open({
                            filters: [{ name: 'Lyrics File', extensions: options.extensions || ['txt', 'json', 'lrc'] }]
                        });
                        if (!selected || typeof selected !== 'string') return null;
                        const content = await window.__TAURI__.fs.readTextFile(selected);
                        return { filename: selected.split(/[\/\\]/).pop(), content };
                    }
                    return null;
                } else {
                    // Web: HTML5 File Input
                    return new Promise((resolve) => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = (options.extensions || ['txt', 'json', 'lrc']).map(ext => `.${ext}`).join(',');
                        input.style.display = 'none';
                        document.body.appendChild(input);

                        input.onchange = (e) => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) {
                                document.body.removeChild(input);
                                return resolve(null);
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                document.body.removeChild(input);
                                resolve({ filename: file.name, content: event.target.result });
                            };
                            reader.onerror = () => {
                                document.body.removeChild(input);
                                resolve(null);
                            };
                            reader.readAsText(file);
                        };

                        input.click();
                    });
                }
            },

            /**
             * Saves file content to user's device.
             * @param {string} content
             * @param {string} defaultFilename
             * @param {string} mimeType
             * @returns {Promise<boolean>}
             */
            async saveFile(content, defaultFilename = 'lyrics.txt', mimeType = 'text/plain') {
                if (Platform.isTauri()) {
                    if (window.__TAURI__ && window.__TAURI__.dialog) {
                        const savePath = await window.__TAURI__.dialog.save({ defaultPath: defaultFilename });
                        if (!savePath) return false;
                        await window.__TAURI__.fs.writeTextFile(savePath, content);
                        return true;
                    }
                    return false;
                } else {
                    // Web: Blob Virtual Download
                    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = defaultFilename.endsWith('.txt') ? defaultFilename : `${defaultFilename}.txt`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    return true;
                }
            }
        },

        // 4. Window & Navigation Adapters
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
                if (typeof checkerFn === 'function') checkerFn();
            } else {
                console.log("[Platform] Running in browser environment. Desktop installer check skipped.");
            }
        },

        registerUnloadGuard(hasUnsavedChangesFn) {
            if (Platform.isWeb()) {
                window.addEventListener('beforeunload', (e) => {
                    if (typeof hasUnsavedChangesFn === 'function' && hasUnsavedChangesFn()) {
                        e.preventDefault();
                        e.returnValue = '';
                    }
                });
            }
        }
    };

    // =========================================================================
    // Virtual Fetch Interceptor for Web Environment
    // Intercepts REST-style calls made by index.js and redirects to Platform.storage
    // =========================================================================
    if (Platform.isWeb()) {
        const originalFetch = window.fetch;
        window.fetch = async function(url, options = {}) {
            const rawUrl = typeof url === 'string' ? url : (url.url || String(url));
            // Normalize path to ignore leading slash or relative prefix
            const urlPath = rawUrl.split('?')[0].replace(/^(\.\/|\/)/, '');
            const queryString = rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?') + 1) : '';

            const mockResponse = (data, status = 200) => {
                const str = typeof data === 'string' ? data : JSON.stringify(data);
                return Promise.resolve({
                    ok: status >= 200 && status < 300,
                    status: status,
                    json: async () => (typeof data === 'string' ? JSON.parse(data) : data),
                    text: async () => str
                });
            };

            try {
                // 1. Config
                if (urlPath === 'api/config') {
                    return mockResponse(Platform.storage.loadConfig());
                }
                if (urlPath === 'api/save-config') {
                    const body = JSON.parse(options.body || '{}');
                    return mockResponse(Platform.storage.saveConfig(body));
                }

                // 2. Character DB
                if (urlPath === 'colors.json') {
                    return mockResponse(Platform.storage.loadCharacterDb('standard'));
                }
                if (urlPath === 'colors_sekai.json') {
                    return mockResponse(Platform.storage.loadCharacterDb('sekai'));
                }
                if (urlPath === 'colors_unit.json') {
                    return mockResponse(Platform.storage.loadCharacterDb('unit'));
                }
                if (urlPath === 'api/save') {
                    const body = JSON.parse(options.body || '{}');
                    return mockResponse(Platform.storage.saveCharacter(body));
                }
                if (urlPath === 'api/delete') {
                    const body = JSON.parse(options.body || '{}');
                    return mockResponse(Platform.storage.deleteCharacter(body));
                }

                // 3. Lyrics
                if (urlPath === 'api/save-lyrics') {
                    const body = JSON.parse(options.body || '{}');
                    const res = await Platform.storage.saveLyrics(body.filename, body.content);
                    return mockResponse(res);
                }
                if (urlPath === 'api/list-lyrics') {
                    const list = await Platform.storage.listLyrics();
                    return mockResponse(list);
                }
                if (urlPath === 'api/load-lyrics') {
                    const params = new URLSearchParams(queryString);
                    const file = params.get('file') || '';
                    const res = await Platform.storage.loadLyrics(file);
                    return mockResponse(res);
                }
                if (urlPath === 'api/delete-lyrics') {
                    const body = JSON.parse(options.body || '{}');
                    const res = await Platform.storage.deleteLyrics(body.filename);
                    return mockResponse(res);
                }

                // 4. Patchnotes & Samples (Support sub-path relative fetching)
                if (urlPath === 'api/patchnotes' || urlPath === 'data/patchnotes.json' || urlPath === 'patchnotes.json') {
                    try {
                        const relativeResp = await originalFetch('data/patchnotes.json');
                        if (relativeResp.ok) return relativeResp;
                    } catch (_) {}
                    return mockResponse([]);
                }
                if (urlPath === 'sample.json') {
                    try {
                        const relativeResp = await originalFetch('sample.json');
                        if (relativeResp.ok) return relativeResp;
                    } catch (_) {}
                    return mockResponse({ activeCharacters: ["하츠네 미쿠"], lyrics: "" });
                }

                // 5. Logging & Process Exits
                if (urlPath === 'api/log-text' || urlPath === 'api/log-error') {
                    return mockResponse({ status: 'logged' });
                }
                if (urlPath === 'api/force-exit' || urlPath === 'api/exit-app') {
                    return mockResponse({ status: 'exiting' });
                }
            } catch (err) {
                console.warn("[Platform.fetchInterceptor] Interceptor error for", rawUrl, err);
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: async () => ({ error: err.message }),
                    text: async () => JSON.stringify({ error: err.message })
                });
            }

            // Fallback to original fetch (e.g. for external assets or CDNs)
            return originalFetch.apply(this, arguments);
        };
    }

    // Expose globally
    window.Platform = Platform;
})();
