/* ==========================================================================
   NamuVocaroLyric Frontend Logic Engine (index.js)
   ========================================================================== */

// ==========================================================================
// TAURI HYBRID IPC ADAPTER (Intercept global fetch to run Tauri commands)
// ==========================================================================
(function() {
    if (window.__TAURI__) {
        const originalFetch = window.fetch;
        window.fetch = async function(url, options = {}) {
            const urlStr = typeof url === 'string' ? url : (url.url || String(url));
            const invoke = window.__TAURI__.invoke;
            
            try {
                // 1. Config loading / saving
                if (urlStr === '/api/config') {
                    const config = await invoke('load_config');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => config,
                        text: async () => JSON.stringify(config)
                    };
                }
                if (urlStr === '/api/save-config') {
                    const body = JSON.parse(options.body);
                    await invoke('save_config', { config: body });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'saved' }),
                        text: async () => '{"status":"saved"}'
                    };
                }
                
                // 2. Character database loading / saving / deleting
                if (urlStr === '/colors.json') {
                    const data = await invoke('load_character_db', { category: 'standard' });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => data,
                        text: async () => JSON.stringify(data)
                    };
                }
                if (urlStr === '/colors_sekai.json') {
                    const data = await invoke('load_character_db', { category: 'sekai' });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => data,
                        text: async () => JSON.stringify(data)
                    };
                }
                if (urlStr === '/colors_unit.json') {
                    const data = await invoke('load_character_db', { category: 'unit' });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => data,
                        text: async () => JSON.stringify(data)
                    };
                }
                if (urlStr === '/api/save') {
                    const body = JSON.parse(options.body);
                    await invoke('save_character', {
                        category: body.category || '',
                        isEdit: !!body.isEdit,
                        origName: body.origName || '',
                        name: body.name || '',
                        color1: body.color_1 || {},
                        color2: body.color_2 || {},
                        aliases: body.aliases || []
                    });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'success' }),
                        text: async () => '{"status":"success"}'
                    };
                }
                if (urlStr === '/api/delete') {
                    const body = JSON.parse(options.body);
                    await invoke('delete_character', {
                        category: body.category || '',
                        name: body.name || ''
                    });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'success' }),
                        text: async () => '{"status":"success"}'
                    };
                }
                
                // 3. Lyrics saving / listing / loading
                if (urlStr === '/api/save-lyrics') {
                    const body = JSON.parse(options.body);
                    const res = await invoke('save_lyrics', {
                        filename: body.filename,
                        content: body.content
                    });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => res,
                        text: async () => JSON.stringify(res)
                    };
                }
                if (urlStr === '/api/delete-lyrics') {
                    const body = JSON.parse(options.body);
                    await invoke('delete_lyrics', {
                        filename: body.filename
                    });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'success' }),
                        text: async () => '{"status":"success"}'
                    };
                }
                if (urlStr === '/api/list-lyrics') {
                    const list = await invoke('list_lyrics');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => list,
                        text: async () => JSON.stringify(list)
                    };
                }
                if (urlStr.startsWith('/api/load-lyrics')) {
                    // Extract query parameters
                    let filename = '';
                    const qIdx = urlStr.indexOf('?');
                    if (qIdx !== -1) {
                        const params = new URLSearchParams(urlStr.substring(qIdx));
                        filename = params.get('file') || '';
                    }
                    const res = await invoke('load_lyrics', { filename: filename });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => res,
                        text: async () => JSON.stringify(res)
                    };
                }

                // 4. Patchnotes
                if (urlStr === '/api/patchnotes' || urlStr === '/data/patchnotes.json' || urlStr === 'data/patchnotes.json') {
                    const data = await invoke('load_patchnotes');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => data,
                        text: async () => JSON.stringify(data)
                    };
                }
                
                // 5. Logging
                if (urlStr === '/api/log-text') {
                    const body = JSON.parse(options.body);
                    await invoke('log_text', {
                        rawText: body.rawText || '',
                        markdownCode: body.markdownCode || ''
                    });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'logged' }),
                        text: async () => '{"status":"logged"}'
                    };
                }
                if (urlStr === '/api/log-error') {
                    const body = JSON.parse(options.body);
                    await invoke('log_error', {
                        code: String(body.code || ''),
                        errorType: body.type || '',
                        message: body.message || '',
                        stack: body.stack || ''
                    });
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'logged' }),
                        text: async () => '{"status":"logged"}'
                    };
                }
                if (urlStr === '/api/force-exit') {
                    await invoke('force_exit');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'exiting' }),
                        text: async () => '{"status":"exiting"}'
                    };
                }
                if (urlStr === '/api/exit-app') {
                    await invoke('exit_app');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ status: 'exiting' }),
                        text: async () => '{"status":"exiting"}'
                    };
                }
            } catch (err) {
                console.error(`Tauri IPC Invoke error for ${urlStr}:`, err);
                return {
                    ok: false,
                    status: 500,
                    json: async () => { throw err; },
                    text: async () => { throw err; }
                };
            }
            
            return originalFetch.apply(this, arguments);
        };
    }
})();


// --- GLOBAL STATE ---
let CHAR_DB = {}; // Mapped as: { "하츠네 미쿠": { color_1: {...}, color_2: {...}, category: "...", aliases: [...] } }
let VERSION_OVERRIDE = null; // 디버그용 버전 강제 오버라이드
let ACTIVE_CHARACTERS = []; // Array of active character names for the current song
let DEFAULT_CHARACTER = null; // 사용자가 수동 설정한 표 디폴트 캐릭터
let CURRENT_TAB = 'visual'; // 'visual' or 'code'
let CURRENT_THEME = 'light'; // 'dark' or 'light'
let CURRENT_FONT = 'system'; // 'system' or other fonts
let isBackspaceActive = false; // 백스페이스 작동 시 이스터에그 이스케이프 플래그
let backspaceTimeout = null;
let IS_PREVIEW_LOGGER_ACTIVE = false;
let IS_TEXT_LOGGER_ACTIVE = false;
let IS_PURE_BLACK_ACTIVE = false;
let IS_DEV_MODE_ACTIVE = false;
let isSyncingEditorScroll = false;
let isSyncingPreviewScroll = false;
let CURRENT_LYRICS_FILENAME = '';
let isUserEditingStarted = false; // 실제 사용자의 키보드 입력 또는 곡 복원 시 활성화되는 자동 저장용 세션 플래그
let hasUnsavedChanges = false; // 에디터 내 저장되지 않은 수정본 존재 여부 플래그
let LYRICS_FILES_CACHE = [];
let LAST_DETECTED_CHARACTERS = new Set(); // Track characters currently present in the editor text

// 헬퍼: CURRENT_LYRICS_FILENAME 설정, localStorage 및 곡명 디스플레이 동기화 통합 관리
function setCurrentLyricsFilename(filename) {
    CURRENT_LYRICS_FILENAME = filename;
    if (filename) {
        localStorage.setItem('current_lyrics_filename', filename);
    } else {
        localStorage.removeItem('current_lyrics_filename');
    }
    updateSongTitleDisplay();
}



// Base default colors for full/partial chorus, subtitles, narrations
const SPECIAL_CHARACTERS = {
    "전체 합창": {
        color_1: { bg: "#000000,#000000", txt: "#ffffff,#ffffff" },
        color_2: { bg: "#f0f0f0,#303237", txt: "#212529,#ffffff" },
        aliases: ["합창", "전체합창", "all", "chorus"]
    },
    "부분 합창": {
        color_1: { bg: "#898983,#898983", txt: "#ffffff,#ffffff" },
        color_2: { bg: "#ffffff,#1c1d1f", txt: "#212529,#ffffff" },
        aliases: ["부분합창", "pchorus", "p_chorus"]
    },
    "영상 자막": {
        color_1: { bg: "#46505f,#46505f", txt: "#ffffff,#ffffff" },
        color_2: { bg: "#e3e3e3,#35383d", txt: "#212529,#ffffff" },
        aliases: ["자막", "영상자막", "subtitles", "subtitle"],
        italic: true
    },
    "나레이션": {
        color_1: { bg: "#46505f,#46505f", txt: "#ffffff,#ffffff" },
        color_2: { bg: "#e3e3e3,#35383d", txt: "#212529,#ffffff" },
        aliases: ["나레이션", "내레이션", "narration", "narr"],
        italic: true
    }
};

async function deleteAutosaveFile() {
    try {
        const response = await fetch('/api/delete-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: "_autosave.txt" })
        });
        if (!response.ok) {
            console.error("Failed to delete autosave file: status", response.status);
        }
    } catch (err) {
        console.error("Error calling delete-lyrics API:", err);
    }
}

async function checkAndRestoreAutosave() {
    try {
        const response = await fetch('/api/list-lyrics');
        if (!response.ok) return;
        const list = await response.json();
        const autosaveFile = list.find(f => f.name === "_autosave.txt" && f.size > 0);
        if (!autosaveFile) return;

        // 복구 안내 모달 노출
        const recoveryModal = document.getElementById('autosave-recovery-modal');
        if (!recoveryModal) return;
        recoveryModal.classList.remove('hidden');

        const btnYes = document.getElementById('btn-autosave-yes');
        const btnNo = document.getElementById('btn-autosave-no');
        const startModal = document.getElementById('start-setup-modal');

        const controller = new AbortController();
        const signal = controller.signal;

        const hideModal = () => {
            recoveryModal.classList.add('hidden');
            controller.abort();
        };

        btnYes.addEventListener('click', async () => {
            try {
                const loadRes = await fetch('/api/load-lyrics?file=_autosave.txt');
                if (loadRes.ok) {
                    const data = await loadRes.json();
                    const editor = document.getElementById('lyrics-editor');
                    if (editor && data.content) {
                        undoStack = [];
                        redoStack = [];
                        isTyping = false;
                        editor.value = data.content;
                        capturePrevState();
                        updateRowNumbers();
                        
                        // 복구 성공 시 로컬스토리지에 저장해두었던 이전 파일명 컨텍스트 복원
                        const savedFilename = localStorage.getItem('current_lyrics_filename');
                        if (savedFilename) {
                            setCurrentLyricsFilename(savedFilename);
                        } else {
                            setCurrentLyricsFilename('');
                        }
                        isUserEditingStarted = true; // 세션 활성화
                        hasUnsavedChanges = true; // 복원 시점에는 저장되지 않은 임시 변경 데이터 상태임
                        
                        // 캐릭터 감지 및 렌더링 정상 연동을 위해 triggerRender 기동
                        triggerRender(true);
                    }
                    showToast("이전 임시 저장 데이터가 복구되었습니다.", 'success');
                }
            } catch (err) {
                console.error("Failed to load autosave content:", err);
                showToast("임시 저장본 복구 도중 오류가 발생했습니다.", 'danger-bug');
            } finally {
                // 복구 성공 여부와 상관없이 파일 청소 및 모달 닫기
                await deleteAutosaveFile();
                
                if (startModal) startModal.classList.add('hidden');
                hideModal();
            }
        }, { signal });

        btnNo.addEventListener('click', async () => {
            // 복구 거부 시 임시 파일 삭제 및 에디터 비우기
            const editor = document.getElementById('lyrics-editor');
            if (editor) {
                undoStack = [];
                redoStack = [];
                isTyping = false;
                editor.value = '';
                capturePrevState();
                updateRowNumbers();
                setCurrentLyricsFilename(''); // 거부 시 저장 파일명 정보 초기화
                isUserEditingStarted = false; // 세션 비활성화
                triggerRender(true);
            }
            await deleteAutosaveFile();
            
            showToast("임시 저장본이 삭제되었습니다.", 'info');
            hideModal();
        }, { signal });

    } catch (err) {
        console.error("Autosave recovery system error:", err);
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('light-mode');
    await loadDatabase();
    await loadConfigFromServer();
    initTheme();
    applyTheme(); // Ensure initial classes are correctly set based on states
    applyTabState();
    applyFont();

    initTabs();
    initEditor();
    initDBModal();
    initActiveChars();
    initSampleLoader();
    initSettings();
    initLyricsFileControls();
    initStartSetupModal();
    initCloseConfirmModal();
    initPatchnotes();
    updateSongTitleDisplay();
    
    // Initial render
    triggerRender();

    // 임시 저장 복구 검사 기동
    await checkAndRestoreAutosave();

    // 자동 업데이트 체크 기동 (즉시 실행)
    checkForUpdates();

});

// --- CONFIGURATION MANAGEMENT (SAVE/LOAD) ---
async function loadConfigFromServer() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            if (config.theme) CURRENT_THEME = config.theme;
            if (config.defaultTab) CURRENT_TAB = config.defaultTab;
            if (config.font) CURRENT_FONT = config.font;
            if (config.pureBlack !== undefined) IS_PURE_BLACK_ACTIVE = config.pureBlack;
            if (config.isPreviewLoggerActive !== undefined) IS_PREVIEW_LOGGER_ACTIVE = config.isPreviewLoggerActive;
            if (config.isTextLoggerActive !== undefined) IS_TEXT_LOGGER_ACTIVE = config.isTextLoggerActive;
            if (config.isDevModeActive !== undefined) IS_DEV_MODE_ACTIVE = config.isDevModeActive;
            if (config.versionOverride) VERSION_OVERRIDE = config.versionOverride;
            applyDevModeUI();
        }
    } catch (err) {
        console.error('Failed to load settings configuration from server:', err);
    }
}

async function saveConfigOnServer() {
    try {
        const config = {
            theme: CURRENT_THEME,
            defaultTab: CURRENT_TAB,
            font: CURRENT_FONT,
            pureBlack: IS_PURE_BLACK_ACTIVE,
            isPreviewLoggerActive: IS_PREVIEW_LOGGER_ACTIVE,
            isTextLoggerActive: IS_TEXT_LOGGER_ACTIVE,
            isDevModeActive: IS_DEV_MODE_ACTIVE
        };
        await fetch('/api/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
    } catch (err) {
        console.error('Failed to save settings configuration on server:', err);
    }
}

function applyDevModeUI() {
    const debugGroup = document.getElementById('settings-debug-group');
    if (!debugGroup) return;
    if (IS_DEV_MODE_ACTIVE) {
        debugGroup.classList.remove('hidden');
    } else {
        debugGroup.classList.add('hidden');
    }
}

function applyFont() {
    const editor = document.getElementById('lyrics-editor');
    if (!editor) return;
    editor.classList.remove('font-system', 'font-notosans', 'font-notoserif', 'font-nanumgothic', 'font-nanumbarun', 'font-maruburi', 'font-pretendardjp');
    editor.classList.add(`font-${CURRENT_FONT}`);
}

// --- THEME & TAB CONTROLS ---
function applyTheme() {
    if (CURRENT_THEME === 'dark') {
        document.body.classList.remove('light-mode');
        if (IS_PURE_BLACK_ACTIVE) {
            document.body.classList.add('pure-black');
        } else {
            document.body.classList.remove('pure-black');
        }
    } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('pure-black');
    }
}

function applyTabState() {
    const btnVisual = document.getElementById('tab-visual');
    const btnCode = document.getElementById('tab-code');
    const contentVisual = document.getElementById('content-visual');
    const contentCode = document.getElementById('content-code');
    if (!btnVisual || !btnCode) return;
    
    if (CURRENT_TAB === 'visual') {
        btnVisual.classList.add('active');
        btnCode.classList.remove('active');
        if (contentVisual) contentVisual.classList.add('active-content');
        if (contentCode) contentCode.classList.remove('active-content');
    } else {
        btnCode.classList.add('active');
        btnVisual.classList.remove('active');
        if (contentCode) contentCode.classList.add('active-content');
        if (contentVisual) contentVisual.classList.remove('active-content');
    }
}

function initTheme() {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        btn.addEventListener('click', () => {
            if (document.body.classList.contains('light-mode')) {
                CURRENT_THEME = 'dark';
            } else {
                CURRENT_THEME = 'light';
            }
            applyTheme();
            renderActiveCharsBar();
            triggerRender();
            // saveConfigOnServer(); // 메인 화면 변경 시 임시 비활성화
        });
    }
}

function initTabs() {
    const btnVisual = document.getElementById('tab-visual');
    const btnCode = document.getElementById('tab-code');
    
    if (btnVisual) {
        btnVisual.addEventListener('click', () => {
            CURRENT_TAB = 'visual';
            applyTabState();
            triggerRender();
            // saveConfigOnServer(); // 메인 화면 변경 시 임시 비활성화
            
            // 탭 활성화 시점에 스크롤 비율이 맞도록 강제 동기화
            setTimeout(() => {
                const editor = document.getElementById('lyrics-editor');
                const previewWrapper = document.querySelector('.preview-scroll-wrapper');
                if (editor && previewWrapper) {
                    const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
                    if (editorMaxScroll > 0) {
                        const scrollRatio = editor.scrollTop / editorMaxScroll;
                        const previewMaxScroll = previewWrapper.scrollHeight - previewWrapper.clientHeight;
                        previewWrapper.scrollTop = scrollRatio * previewMaxScroll;
                    }
                }
            }, 50);
        });
    }
    
    if (btnCode) {
        btnCode.addEventListener('click', () => {
            CURRENT_TAB = 'code';
            applyTabState();
            triggerRender();
            // saveConfigOnServer(); // 메인 화면 변경 시 임시 비활성화
        });
    }
}

// --- DATABASE SERVICE LAYER ---
async function loadDatabase() {
    try {
        // Fetch the parsed local JSON files served by our PowerShell server
        const [resStd, resSekai, resUnit] = await Promise.all([
            fetch('/colors.json').then(r => r.json()),
            fetch('/colors_sekai.json').then(r => r.json()),
            fetch('/colors_unit.json').then(r => r.json())
        ]);
        
        CHAR_DB = {};
        
        // Merge them into our primary runtime DB, storing their respective category
        Object.keys(resStd).forEach(name => {
            const raw = resStd[name].aliases || [];
            const clean = Array.isArray(raw) ? raw.filter(a => a.toLowerCase() !== name.toLowerCase()) : [];
            CHAR_DB[name] = { ...resStd[name], category: 'standard', aliases: clean };
        });
        Object.keys(resSekai).forEach(name => {
            const raw = resSekai[name].aliases || [];
            const clean = Array.isArray(raw) ? raw.filter(a => a.toLowerCase() !== name.toLowerCase()) : [];
            CHAR_DB[name] = { ...resSekai[name], category: 'sekai', aliases: clean };
        });
        Object.keys(resUnit).forEach(name => {
            const raw = resUnit[name].aliases || [];
            const clean = Array.isArray(raw) ? raw.filter(a => a.toLowerCase() !== name.toLowerCase()) : [];
            CHAR_DB[name] = { ...resUnit[name], category: 'unit', aliases: clean };
        });
        
        // Feed in standard aliases from our metadata or files
        // E.g., add short aliases
        addAliases("하츠네 미쿠", ["미쿠", "miku"]);
        addAliases("카가미네 린", ["린", "rin"]);
        addAliases("카가미네 렌", ["렌", "len"]);
        addAliases("메구리네 루카", ["루카", "luka"]);
        addAliases("유즈키 유카리", ["유카리", "yukari"]);
        addAliases("카사네 테토", ["테토", "teto"]);
        addAliases("즌다몬", ["즌다", "zundamon"]);
        
        console.log(`Successfully loaded ${Object.keys(CHAR_DB).length} characters into database.`);
    } catch (e) {
        console.error("Failed to load database from server. Running on local colors_data.js fallback.", e);
        CHAR_DB = {};
        
        const stdSource = (typeof DEFAULT_COLORS_STD !== 'undefined') ? DEFAULT_COLORS_STD : {};
        const sekaiSource = (typeof DEFAULT_COLORS_SEKAI !== 'undefined') ? DEFAULT_COLORS_SEKAI : {};
        const unitSource = (typeof DEFAULT_COLORS_UNIT !== 'undefined') ? DEFAULT_COLORS_UNIT : {};
        
        Object.keys(stdSource).forEach(name => {
            const raw = stdSource[name].aliases || [];
            const clean = Array.isArray(raw) ? raw.filter(a => a.toLowerCase() !== name.toLowerCase()) : [];
            CHAR_DB[name] = { ...stdSource[name], category: 'standard', aliases: clean };
        });
        Object.keys(sekaiSource).forEach(name => {
            const raw = sekaiSource[name].aliases || [];
            const clean = Array.isArray(raw) ? raw.filter(a => a.toLowerCase() !== name.toLowerCase()) : [];
            CHAR_DB[name] = { ...sekaiSource[name], category: 'sekai', aliases: clean };
        });
        Object.keys(unitSource).forEach(name => {
            const raw = unitSource[name].aliases || [];
            const clean = Array.isArray(raw) ? raw.filter(a => a.toLowerCase() !== name.toLowerCase()) : [];
            CHAR_DB[name] = { ...unitSource[name], category: 'unit', aliases: clean };
        });
        
        if (Object.keys(CHAR_DB).length === 0) {
            CHAR_DB["하츠네 미쿠"] = { color_1: { bg: "#39c5bb,#16171a", txt: "#ffffff,#39c5bb" }, color_2: { bg: "#ecfffb,#1a2b2d", txt: "#212529,#ffffff" }, category: 'standard', aliases: ["미쿠", "miku"] };
        }
        
        addAliases("하츠네 미쿠", ["미쿠", "miku"]);
        addAliases("카가미네 린", ["린", "rin"]);
        addAliases("카가미네 렌", ["렌", "len"]);
        addAliases("메구리네 루카", ["루카", "luka"]);
        addAliases("유즈키 유카리", ["유카리", "yukari"]);
        addAliases("카사네 테토", ["테토", "teto"]);
        addAliases("즌다몬", ["즌다", "zundamon"]);
        
        console.log(`Offline fallback loaded ${Object.keys(CHAR_DB).length} characters into database.`);
    }
}

function addAliases(charName, aliases) {
    if (CHAR_DB[charName]) {
        const cleanNew = aliases.filter(a => a.toLowerCase() !== charName.toLowerCase());
        CHAR_DB[charName].aliases = Array.from(new Set([...CHAR_DB[charName].aliases, ...cleanNew]));
    }
}

// Find a character or special part matching an alias/name
function resolveCharacter(identifier) {
    if (!identifier) return null;
    
    // Safe shield: If already resolved to a character object, return it directly
    if (typeof identifier === 'object') {
        return identifier;
    }
    
    const cleanId = identifier.toString().trim().toLowerCase();
    
    // 1. Search special parts (chorus, narrations, etc.)
    for (const key of Object.keys(SPECIAL_CHARACTERS)) {
        if (key.toLowerCase() === cleanId || SPECIAL_CHARACTERS[key].aliases.includes(cleanId)) {
            return { name: key, ...SPECIAL_CHARACTERS[key], isSpecial: true };
        }
    }
    
    // 2. Search main DB characters
    for (const key of Object.keys(CHAR_DB)) {
        if (key.toLowerCase() === cleanId || CHAR_DB[key].aliases.includes(cleanId)) {
            return { name: key, ...CHAR_DB[key], isSpecial: false };
        }
    }
    
    return null;
}

// --- ACTIVE CHARACTERS MANAGEMENT ---
function initActiveChars() {
    const btnAdd = document.getElementById('btn-add-active-char');
    const modal = document.getElementById('add-char-modal');
    const btnClose = document.getElementById('btn-close-add-char');
    const searchInput = document.getElementById('char-search-input');
    const resultsContainer = document.getElementById('char-search-results');
    
    btnAdd.addEventListener('click', () => {
        modal.classList.remove('hidden');
        searchInput.value = '';
        renderActiveSearch('');
        searchInput.focus();
    });
    
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
    
    searchInput.addEventListener('input', (e) => {
        renderActiveSearch(e.target.value);
    });
    
    // Clean slate: start with an empty active list. Used characters are auto-detected in real-time.
}

function addActiveCharacter(name, skipRender = false) {
    if (!name || ACTIVE_CHARACTERS.includes(name)) return;
    ACTIVE_CHARACTERS.push(name);
    renderActiveCharsBar();
    if (!skipRender) {
        triggerRender();
    }
}

function removeActiveCharacter(name) {
    ACTIVE_CHARACTERS = ACTIVE_CHARACTERS.filter(n => n !== name);
    if (DEFAULT_CHARACTER === name) {
        DEFAULT_CHARACTER = null; // 디폴트 캐릭터 지정이 삭제되면 초기화
    }
    renderActiveCharsBar();
    triggerRender();
}

function renderActiveCharsBar() {
    const listMain = document.getElementById('active-chars-list');
    const listStart = document.getElementById('start-active-chars-list');
    
    if (listMain) listMain.innerHTML = '';
    if (listStart) listStart.innerHTML = '';
    
    ACTIVE_CHARACTERS.forEach(name => {
        const char = CHAR_DB[name];
        if (!char) return;
        
        // Grab current theme primary bg color
        const bgColors = char.color_1.bg.split(',');
        // 다크모드 배경은 모두 칙칙한 회검정(#16171a)이므로, 배지 도트는 항상 캐릭터 고유의 선명한 라이트모드 배경색(상징색)을 칠해 보여줍니다.
        const colorVal = bgColors[0];
        
        const isDefault = (DEFAULT_CHARACTER === name) || (!DEFAULT_CHARACTER && ACTIVE_CHARACTERS[0] === name);
        
        // Helper to build badge
        const buildBadge = () => {
            const badge = document.createElement('div');
            badge.className = 'char-badge';
            if (isDefault) badge.classList.add('is-default');
            
            badge.innerHTML = `
                ${isDefault ? '<span class="crown-emoji" title="디폴트 가창 캐릭터">👑</span>' : ''}
                <span class="color-dot" style="background-color: ${colorVal}"></span>
                <span class="char-name">${name}</span>
                <button class="char-remove" title="목록에서 삭제">&times;</button>
                
                <!-- 호버 시 아래에 표시될 대표 지정 미니 레이어 -->
                <div class="char-badge-tooltip">
                    <label class="tooltip-label">
                        <input type="checkbox" class="default-char-checkbox" ${isDefault ? 'checked' : ''} />
                        <span>👑 대표 지정</span>
                    </label>
                </div>
            `;
            
            badge.querySelector('.char-remove').addEventListener('click', (e) => {
                e.stopPropagation(); // 대표 지정 등 배지 클릭 이벤트 전파 차단
                removeActiveCharacter(name);
            });
            
            // 체크박스 클릭(change) 시 대표 설정 스위칭
            const checkbox = badge.querySelector('.default-char-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation(); // 이벤트 전파 방지
                    if (checkbox.checked) {
                        DEFAULT_CHARACTER = name;
                    } else {
                        if (DEFAULT_CHARACTER === name) {
                            DEFAULT_CHARACTER = null;
                        }
                    }
                    renderActiveCharsBar();
                    triggerRender();
                });
            }
            return badge;
        };
        
        if (listMain) listMain.appendChild(buildBadge());
        if (listStart) listStart.appendChild(buildBadge());
    });
}

function renderActiveSearch(query) {
    const container = document.getElementById('char-search-results');
    container.innerHTML = '';
    
    const cleanQuery = query.toLowerCase().trim();
    const cleanQueryJongFree = removeLastJongseong(cleanQuery);
    
    // Filter from global DB
    const matches = Object.keys(CHAR_DB).filter(name => {
        if (!cleanQuery) return true;
        const char = CHAR_DB[name];
        const nameLower = name.toLowerCase();
        
        const matchOriginal = nameLower.includes(cleanQuery) || 
                              char.aliases.some(a => a.toLowerCase().includes(cleanQuery));
                              
        const matchJongFree = nameLower.includes(cleanQueryJongFree) ||
                              char.aliases.some(a => a.toLowerCase().includes(cleanQueryJongFree));
                              
        return matchOriginal || matchJongFree;
    });
    
    if (matches.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:1rem;">검색 결과가 없습니다.</div>`;
        return;
    }
    
    matches.forEach(name => {
        const char = CHAR_DB[name];
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const bgColors = char.color_1.bg.split(',');
        const badgeBg = CURRENT_THEME === 'dark' ? (bgColors[1] || bgColors[0]) : bgColors[0];
        
        item.innerHTML = `
            <span class="color-dot" style="background-color: ${badgeBg}"></span>
            <span class="char-name">${name}</span>
            <span class="char-cat">${char.category === 'sekai' ? '프로세카' : char.category === 'unit' ? '유닛' : '보컬'}</span>
        `;
        
        item.addEventListener('click', () => {
            addActiveCharacter(name);
            document.getElementById('add-char-modal').classList.add('hidden');
        });
        
        container.appendChild(item);
    });
}

// --- UNDO / REDO HISTORY ENGINE ---
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 100;

let prevState = {
    value: '',
    selectionStart: 0,
    selectionEnd: 0
};
let isTyping = false;
let typingTimer = null;

function capturePrevState() {
    if (!editor) return;
    prevState = {
        value: editor.value,
        selectionStart: editor.selectionStart,
        selectionEnd: editor.selectionEnd
    };
}

function commitPrevStateToUndo() {
    if (!editor) return;
    if (undoStack.length > 0 && undoStack[undoStack.length - 1].value === prevState.value) {
        return;
    }
    undoStack.push({ ...prevState });
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    redoStack = [];
}

function handleTypingInput() {
    if (!editor) return;
    if (!isTyping) {
        commitPrevStateToUndo();
        isTyping = true;
    }
    
    if (typingTimer) clearTimeout(typingTimer);
    
    const text = editor.value;
    const pos = editor.selectionStart;
    const lastChar = text.charAt(pos - 1);
    
    if (lastChar === ' ' || lastChar === '\n') {
        capturePrevState();
        commitPrevStateToUndo();
        isTyping = false;
    } else {
        typingTimer = setTimeout(() => {
            capturePrevState();
            commitPrevStateToUndo();
            isTyping = false;
        }, 500);
    }
}

function undo() {
    if (undoStack.length === 0) return;
    
    redoStack.push({
        value: editor.value,
        selectionStart: editor.selectionStart,
        selectionEnd: editor.selectionEnd
    });
    
    const state = undoStack.pop();
    editor.value = state.value;
    editor.selectionStart = state.selectionStart;
    editor.selectionEnd = state.selectionEnd;
    
    isTyping = false;
    capturePrevState();
    
    updateRowNumbers();
    triggerRender();
}

function redo() {
    if (redoStack.length === 0) return;
    
    undoStack.push({
        value: editor.value,
        selectionStart: editor.selectionStart,
        selectionEnd: editor.selectionEnd
    });
    
    const state = redoStack.pop();
    editor.value = state.value;
    editor.selectionStart = state.selectionStart;
    editor.selectionEnd = state.selectionEnd;
    
    isTyping = false;
    capturePrevState();
    
    updateRowNumbers();
    triggerRender();
}

// --- LYRICS EDITOR & AUTOCOMPLETE ENGINE ---
let editor, rowNumbers;
function initEditor() {
    editor = document.getElementById('lyrics-editor');
    rowNumbers = document.getElementById('editor-row-numbers');
    const previewWrapper = document.querySelector('.preview-scroll-wrapper');
    
    editor.addEventListener('input', () => {
        hasUnsavedChanges = true;
        updateRowNumbers();
        triggerRender(true);
        triggerAutoSave();
        handleTypingInput();
    });
    
    editor.addEventListener('scroll', () => {
        if (rowNumbers) {
            rowNumbers.scrollTop = editor.scrollTop;
        }
        
        if (CURRENT_TAB !== 'visual' || !previewWrapper) return;
        
        if (isSyncingEditorScroll) {
            isSyncingEditorScroll = false;
            return;
        }
        
        isSyncingPreviewScroll = true;
        const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
        if (editorMaxScroll > 0) {
            const scrollRatio = editor.scrollTop / editorMaxScroll;
            const previewMaxScroll = previewWrapper.scrollHeight - previewWrapper.clientHeight;
            previewWrapper.scrollTop = scrollRatio * previewMaxScroll;
        }
    });
    
    if (previewWrapper) {
        previewWrapper.addEventListener('scroll', () => {
            if (CURRENT_TAB !== 'visual' || !editor) return;
            
            if (isSyncingPreviewScroll) {
                isSyncingPreviewScroll = false;
                return;
            }
            
            isSyncingEditorScroll = true;
            const previewMaxScroll = previewWrapper.scrollHeight - previewWrapper.clientHeight;
            if (previewMaxScroll > 0) {
                const scrollRatio = previewWrapper.scrollTop / previewMaxScroll;
                const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
                editor.scrollTop = scrollRatio * editorMaxScroll;
                if (rowNumbers) {
                    rowNumbers.scrollTop = editor.scrollTop;
                }
            }
        });
    }
    
    // Autocomplete triggers & Backspace Escape & ContextMenu Autocomplete-call detection
    editor.addEventListener('keyup', handleEditorKeyup);
    editor.addEventListener('keydown', (e) => {
        isUserEditingStarted = true; // 사용자가 직접 타이핑을 개시하였으므로 편집 세션 활성화
        
        // Ctrl+Z 및 Ctrl+Y 단축키 가로채기
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
            return;
        }
        
        capturePrevState();
        
        if (e.key === 'Backspace' || e.key === 'Delete') {
            isBackspaceActive = true;
            if (backspaceTimeout) clearTimeout(backspaceTimeout);
            backspaceTimeout = setTimeout(() => {
                isBackspaceActive = false;
            }, 800); // 800ms 동안 갤러리 순간이동 유예
        }
        
        // 지능형 백스페이스 가사 태그 고속 정리 시스템 (Smart Tag Backspace System)
        if (e.key === 'Backspace' && editor.selectionStart === editor.selectionEnd) {
            const pos = editor.selectionStart;
            if (pos > 0) {
                const text = editor.value;
                
                let adjustedPos = pos;
                let isCursorAfterClose = false;
                
                // 커서 바로 앞 문자가 '}' 라면 태그의 뒤에 위치하므로, 
                // 지우기 대상 감지를 위해 커서 위치를 '}' 바로 안쪽(pos - 1)으로 보정해서 스캔합니다.
                if (text.substring(0, pos).endsWith('}')) {
                    adjustedPos = pos - 1;
                    isCursorAfterClose = true;
                }
                
                const textBefore = text.substring(0, adjustedPos);
                const lastOpen = textBefore.lastIndexOf('{');
                const lastCloseBeforeThis = textBefore.lastIndexOf('}');
                
                if (lastOpen !== -1 && lastOpen > lastCloseBeforeThis) {
                    const firstCloseAfter = text.indexOf('}', lastOpen);
                    const nextOpenAfter = text.indexOf('{', lastOpen + 1);
                    
                    if (firstCloseAfter !== -1 && (nextOpenAfter === -1 || nextOpenAfter > firstCloseAfter)) {
                        const lastClose = firstCloseAfter + 1;
                        const tagContent = text.substring(lastOpen, lastClose);
                        const match = tagContent.match(/^\{((?:color|컬러|multicolor|mcolor|부분합창)=)(.*)\}$/i);
                        
                        if (match) {
                            commitPrevStateToUndo();
                            e.preventDefault();
                            const prefix = match[1];
                            const val = match[2]; // 공백 트림하지 않은 원본 값
                            const valStartPos = lastOpen + 1 + prefix.length;
                            const cursorOffset = adjustedPos - valStartPos;
                            
                            // 토큰 분석
                            const tokens = [];
                            let currentPos = 0;
                            const rawTokens = val.split(',');
                            
                            for (let i = 0; i < rawTokens.length; i++) {
                                const rawTok = rawTokens[i];
                                const tokLen = rawTok.length;
                                const start = currentPos;
                                const end = currentPos + tokLen;
                                
                                const trimmed = rawTok.trim();
                                const trimStartOffset = rawTok.indexOf(trimmed);
                                const textStart = (trimmed === "") ? start : start + trimStartOffset;
                                const textEnd = (trimmed === "") ? start : textStart + trimmed.length;
                                
                                tokens.push({
                                    raw: rawTok,
                                    start: start,
                                    end: end,
                                    textStart: textStart,
                                    textEnd: textEnd,
                                    trimmed: trimmed,
                                    index: i
                                });
                                currentPos += tokLen + 1;
                            }
                            
                            // 1순위: 커서가 글자 내부에 속해 있는 토큰 매칭
                            let targetToken = tokens.find(t => t.trimmed !== "" && cursorOffset > t.textStart && cursorOffset <= t.textEnd);
                            
                            // 2순위: 커서가 공백/쉼표 위에 있는 경우, 커서 기준 왼쪽에서 가장 가까운 토큰 매칭
                            if (!targetToken) {
                                const leftTokens = tokens.filter(t => t.trimmed !== "" && t.textEnd <= cursorOffset);
                                if (leftTokens.length > 0) {
                                    // textEnd가 가장 큰 것을 찾음
                                    targetToken = leftTokens.reduce((prev, current) => (prev.textEnd > current.textEnd) ? prev : current);
                                }
                            }
                            
                            // 3순위 (하이브리드 백업): 만약 여전히 토큰을 못 찾았고 끝자락인 경우, 맨 마지막 토큰을 타겟팅
                            if (!targetToken && tokens.length > 0) {
                                if (cursorOffset >= val.length || isCursorAfterClose) {
                                    for (let i = tokens.length - 1; i >= 0; i--) {
                                        if (tokens[i].trimmed !== "") {
                                            targetToken = tokens[i];
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            if (targetToken) {
                                const targetIdx = targetToken.index;
                                
                                // 타겟 토큰을 제외한 나머지 토큰들의 trimmed 리스트
                                const remainingTrimmed = tokens
                                    .filter(t => t.index !== targetIdx)
                                    .map(t => t.trimmed)
                                    .filter(trimmed => trimmed !== "");
                                
                                const newVal = remainingTrimmed.join(', ');
                                
                                if (newVal !== "") {
                                    const newTag = `{${prefix}${newVal}}`;
                                    editor.value = text.substring(0, lastOpen) + newTag + text.substring(lastClose);
                                    
                                    // 새 커서 위치 설정: 지워진 타겟 토큰의 이전 토큰들이 끝나는 위치 뒤
                                    let newCursorPos = valStartPos;
                                    if (targetIdx > 0) {
                                        const prevTokensText = tokens
                                            .slice(0, targetIdx)
                                            .map(t => t.trimmed)
                                            .filter(trimmed => trimmed !== "")
                                            .join(', ');
                                        if (prevTokensText !== "") {
                                            newCursorPos = valStartPos + prevTokensText.length + 2; // ", " 추가 고려
                                        }
                                    }
                                    
                                    // 새로운 값의 유효 범위를 넘지 않도록 조정
                                    const maxCursorPos = valStartPos + newVal.length;
                                    if (newCursorPos > maxCursorPos) {
                                        newCursorPos = maxCursorPos;
                                    }
                                    
                                    editor.selectionStart = editor.selectionEnd = newCursorPos;
                                } else {
                                    // 지우고 나서 남은 멤버가 하나도 없는 경우 -> 빈 태그 {color=} 로 축소
                                    const newTag = `{${prefix}}`;
                                    editor.value = text.substring(0, lastOpen) + newTag + text.substring(lastClose);
                                    editor.selectionStart = editor.selectionEnd = valStartPos;
                                }
                            } else {
                                // 이미 태그 내에 이름이 아예 없는 상태 -> 태그 전체 삭제
                                editor.value = text.substring(0, lastOpen) + text.substring(lastClose);
                                editor.selectionStart = editor.selectionEnd = lastOpen;
                            }
                            
                            updateRowNumbers();
                            triggerRender();
                            isTyping = false;
                            capturePrevState();
                            return;
                        }
                    }
                }
                
                // 시나리오 2: 커서 직전 문자가 '=' 이고, 그 앞이 가창 태그 선언부이며, 커서 직후가 '}' 인 경우 (태그 내부 {color=[커서]} 상태에서 백스페이스)
                const matchHalf = text.substring(0, pos).match(/\{((?:color|컬러|multicolor|mcolor|부분합창)=)$/i);
                if (matchHalf && text.substring(pos).startsWith('}')) {
                    commitPrevStateToUndo();
                    e.preventDefault();
                    const lastOpen = pos - matchHalf[0].length;
                    // 태그 전체를 소거하고 닫는 중괄호 '}' 도 함께 탈락시킴
                    editor.value = text.substring(0, lastOpen) + text.substring(pos + 1);
                    editor.selectionStart = editor.selectionEnd = lastOpen;
                    
                    updateRowNumbers();
                    triggerRender();
                    isTyping = false;
                    capturePrevState();
                    return;
                }
            }
        }
        
        // 지능형 부분 합창 쉼표(,) 이동 시스템:
        // 커서 직전 문자가 '}' 이고, 이것이 부분 합창(multicolor) 선언 태그인 상태에서 쉼표(,) 입력 시
        // 쉼표를 '}' 안쪽으로 이동시키고 자동완성을 즉시 활성화
        if (e.key === ',' && editor.selectionStart === editor.selectionEnd) {
            const pos = editor.selectionStart;
            const text = editor.value;
            if (pos > 0 && text.charAt(pos - 1) === '}') {
                const textBefore = text.substring(0, pos - 1);
                const lastOpen = textBefore.lastIndexOf('{');
                if (lastOpen !== -1) {
                    const tagContentInside = textBefore.substring(lastOpen + 1);
                    const prefixMatch = tagContentInside.match(/^(?:multicolor|mcolor|부분합창)=/i);
                    if (prefixMatch) {
                        commitPrevStateToUndo();
                        e.preventDefault();
                        editor.value = textBefore + ', ' + '}' + text.substring(pos);
                        // 커서를 안쪽 쉼표와 공백 바로 뒤, '}' 바로 앞에 정위치
                        editor.selectionStart = editor.selectionEnd = pos + 1; 
                        updateRowNumbers();
                        triggerRender();
                        
                        // 자동완성 즉시 호출 (정확한 tagStartIndex 및 tagPrefix 전달)
                        const prefix = prefixMatch[0];
                        const existingNames = tagContentInside.substring(prefix.length);
                        const tagPrefix = prefix + existingNames + ', ';
                        showAutocomplete('', lastOpen, tagPrefix);
                        isTyping = false;
                        capturePrevState();
                        return;
                    }
                }
            }
        }
        
        handleEditorKeydown(e);
    });
    
    // 우클릭 시 커서 위치에 중괄호 { 를 쏙 삽입해주고 자동완성(Autocomplete) 창을 강제로 호출하는 고가성비 단축 제어 장치
    editor.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        capturePrevState();
        
        const pos = editor.selectionStart;
        const text = editor.value;
        
        // 커서 바로 전 문자가 '{' 가 아닐 경우에만 중괄호 주입
        const charBefore = text.charAt(pos - 1);
        if (charBefore !== '{') {
            commitPrevStateToUndo();
            editor.value = text.substring(0, pos) + '{' + text.substring(pos);
            editor.selectionStart = editor.selectionEnd = pos + 1; // 커서를 { 바로 뒤에 정위치
            isTyping = false;
            capturePrevState();
        }
        
        // 그 즉시 해당 캐럿 위치 기준으로 자동완성 UI 팝업 강제 구동!
        showAutocomplete('', editor.selectionStart - 1, '');
    });
    
    // Mouse click inside editor should close autocomplete if cursor jumps elsewhere
    editor.addEventListener('click', () => {
        const pos = editor.selectionStart;
        const box = document.getElementById('autocomplete-box');
        if (!box.classList.contains('hidden') && autocompleteTagStartIndex !== -1) {
            if (pos <= autocompleteTagStartIndex || pos > autocompleteTagStartIndex + 60) {
                hideAutocomplete();
            }
        }
    });
    
    // Autocomplete box click out
    document.addEventListener('click', (e) => {
        if (e.target.id !== 'lyrics-editor' && !e.target.closest('.autocomplete-box')) {
            hideAutocomplete();
        }
    });
    
    document.getElementById('btn-clear-editor').addEventListener('click', () => {
        capturePrevState();
        commitPrevStateToUndo();
        editor.value = '';
        isTyping = false;
        capturePrevState();
        setCurrentLyricsFilename('');
        isUserEditingStarted = false; // 에디터 비울 시 편집 시작 플래그도 초기화
        hasUnsavedChanges = false;
        updateRowNumbers();
        triggerRender();
    });
    
    const optInherit = document.getElementById('opt-inherit-character');
    if (optInherit) {
        optInherit.addEventListener('change', () => {
            triggerRender();
        });
    }
    
    updateRowNumbers();
}

function updateRowNumbers() {
    const lines = editor.value.split('\n');
    let numbers = '';
    for (let i = 1; i <= lines.length; i++) {
        numbers += i + '<br>';
    }
    rowNumbers.innerHTML = numbers;
}

// Float autocomplete menu
let autocompleteActiveIndex = 0;
let autocompleteMatches = [];
let autocompleteTagStartIndex = -1; // Track open curly index globally

function handleEditorKeyup(e) {
    const text = editor.value;
    const pos = editor.selectionStart;
    
    // Check if tag start index exists and cursor moved outside the active range
    const box = document.getElementById('autocomplete-box');
    if (!box.classList.contains('hidden') && autocompleteTagStartIndex !== -1) {
        // If cursor moved before open curly, or drifted too far (e.g. newline or other stanzas)
        if (pos <= autocompleteTagStartIndex || pos > autocompleteTagStartIndex + 60) {
            hideAutocomplete();
            return;
        }
    }
    
    // Check if we are inside a tag like {color= or {컬러= or {multicolor= or just a raw {
    const textBeforeCursor = text.substring(0, pos);
    const lastOpenCurly = textBeforeCursor.lastIndexOf('{');
    
    if (lastOpenCurly !== -1 && lastOpenCurly >= textBeforeCursor.lastIndexOf('}')) {
        // 1. Consecutive curlies check: If the open curly is part of {{{ or {{, skip autocomplete
        const curBefore = textBeforeCursor.substring(lastOpenCurly - 1, lastOpenCurly + 1);
        if (curBefore === '{{') {
            hideAutocomplete();
            return;
        }
        
        const tagContent = textBeforeCursor.substring(lastOpenCurly + 1);
        
        // Match {color=alias, {컬러=alias, {multicolor=alias, {mcolor=alias, {부분합창=alias, or raw {alias
        let query = '';
        let tagPrefix = '';
        
        if (tagContent.match(/^(?:color|컬러)=/i)) {
            query = tagContent.replace(/^(?:color|컬러)=/i, '');
            tagPrefix = tagContent.match(/^(?:color|컬러)=/i)[0];
        } else if (tagContent.match(/^(?:multicolor|mcolor|부분합창)=/i)) {
            // Multicolor can have multiple names separated by comma, take the last name being typed
            const allNames = tagContent.replace(/^(?:multicolor|mcolor|부분합창)=/i, '').split(',');
            query = allNames[allNames.length - 1].trim();
            tagPrefix = tagContent.match(/^(?:multicolor|mcolor|부분합창)=/i)[0] + allNames.slice(0, -1).join(',') + (allNames.length > 1 ? ',' : '');
        } else {
            query = tagContent;
            tagPrefix = '';
        }
        
        showAutocomplete(query, lastOpenCurly, tagPrefix);
    } else {
        hideAutocomplete();
    }
}

function handleEditorKeydown(e) {
    const box = document.getElementById('autocomplete-box');
    if (box.classList.contains('hidden')) return;
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocompleteActiveIndex = (autocompleteActiveIndex + 1) % autocompleteMatches.length;
        renderAutocompleteSelection();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocompleteActiveIndex = (autocompleteActiveIndex - 1 + autocompleteMatches.length) % autocompleteMatches.length;
        renderAutocompleteSelection();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertAutocompleteSelection();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
    }
}

// 한글 종성(받침) 제거 및 자모 분리 상태 보정 헬퍼 함수
function removeLastJongseong(text) {
    if (!text) return text;
    const lastChar = text.charAt(text.length - 1);
    const code = lastChar.charCodeAt(0);
    
    // 1. 한글 음절인 경우 (가 ~ 힣)
    if (code >= 0xAC00 && code <= 0xD7A3) {
        const syllableCode = code - 0xAC00;
        const jong = syllableCode % 28;
        if (jong > 0) {
            return text.substring(0, text.length - 1) + String.fromCharCode(code - jong);
        }
    }
    // 2. 한글 단독 자모인 경우 (호환 자모: 0x3130 ~ 0x318F, 기본 자모: 0x1100 ~ 0x11FF)
    else if ((code >= 0x3130 && code <= 0x318F) || (code >= 0x1100 && code <= 0x11FF)) {
        return text.substring(0, text.length - 1);
    }
    
    return text;
}

function showAutocomplete(query, tagStartIndex, tagPrefix) {
    const box = document.getElementById('autocomplete-box');
    autocompleteTagStartIndex = tagStartIndex; // Store starting index!
    const cleanQuery = query.toLowerCase().trim();
    const cleanQueryJongFree = removeLastJongseong(cleanQuery);
    
    // Build candidate list (Active first, then others, then special parts)
    // Filter out special characters from active list to prevent duplicate entries
    const activeCandidates = ACTIVE_CHARACTERS
        .filter(name => !Object.keys(SPECIAL_CHARACTERS).includes(name))
        .map(name => ({ name, ...(resolveCharacter(name) || CHAR_DB[name]), isActive: true }));
        
    const specialCandidates = Object.keys(SPECIAL_CHARACTERS).map(name => ({ name, ...SPECIAL_CHARACTERS[name], isSpecial: true }));
    
    // Safe shield: Add meta separation keywords for easy manual segment breaks
    const metaCandidates = [
        { name: "공백", aliases: ["blank", "공백", "구분선", "줄바꿈"], isSpecial: true, isMeta: true, color_1: { bg: "#4a5568,#2d3748" } },
        { name: "간주", aliases: ["간주", "instrumental", "inst"], isSpecial: true, isMeta: true, color_1: { bg: "#4a5568,#2d3748" } }
    ];
    
    const otherCandidates = Object.keys(CHAR_DB)
        .filter(name => !ACTIVE_CHARACTERS.includes(name))
        .map(name => ({ name, ...CHAR_DB[name], isActive: false }));
        
    let allCandidates = [...activeCandidates, ...specialCandidates, ...metaCandidates, ...otherCandidates];
    
    // 이미 특정 가창 태그 안쪽으로 들어온 상태(tagPrefix 가 있는 상태)라면,
    // 중첩된 부분 합창 설정이나 공백/간주 같은 아웃오브스케일 지시어들을 추천에서 걸러내어 덮어쓰기 오작동을 차단합니다.
    if (tagPrefix) {
        allCandidates = allCandidates.filter(c => c.name !== "부분 합창" && !c.isMeta);
    }
    
    // Filter candidates by query matching name or alias (with Hangul Jamo support)
    autocompleteMatches = allCandidates.filter(c => {
        if (!cleanQuery) return c.isActive || c.isSpecial; // If empty query, show active/special first
        
        const nameLower = c.name.toLowerCase();
        
        const matchOriginal = nameLower.includes(cleanQuery) || 
                              (c.aliases && c.aliases.some(a => a.toLowerCase().includes(cleanQuery)));
                              
        const matchJongFree = nameLower.includes(cleanQueryJongFree) ||
                              (c.aliases && c.aliases.some(a => a.toLowerCase().includes(cleanQueryJongFree)));
                              
        return matchOriginal || matchJongFree;
    }).slice(0, 8); // Max 8 recommendations
    
    if (autocompleteMatches.length === 0) {
        hideAutocomplete();
        return;
    }
    
    // 1. Populate list items first to compute size correctly
    box.innerHTML = '';
    autocompleteMatches.forEach((c, idx) => {
        const item = document.createElement('div');
        item.className = `autocomplete-item${idx === autocompleteActiveIndex ? ' selected' : ''}`;
        
        const bgColors = (c.color_1 && c.color_1.bg) ? c.color_1.bg.split(',') : ["#898983"];
        const colorVal = CURRENT_THEME === 'dark' ? (bgColors[1] || bgColors[0]) : bgColors[0];
        
        item.innerHTML = `
            <span class="color-dot" style="background-color: ${colorVal}"></span>
            <span class="char-name">${c.name}</span>
            <span class="alias-tag">${c.isMeta ? '구분' : c.isActive ? '참여' : c.isSpecial ? '특수' : 'DB'}</span>
        `;
        
        item.addEventListener('click', () => {
            autocompleteActiveIndex = idx;
            insertAutocompleteSelection();
        });
        
        box.appendChild(item);
    });
    
    // 2. Unhide the box so offsetHeight and offsetWidth can be accurately measured
    box.classList.remove('hidden');
    
    // 3. Dynamic boundary collision detection (stays strictly inside editor wrapper bounds)
    let caretPos = { top: 100, left: 100 };
    try {
        caretPos = getCaretCoordinates(editor, tagStartIndex);
    } catch (err) {
        console.error("Failed to compute caret coordinates under current layout:", err);
    }
    
    const boxHeight = box.offsetHeight || 180;
    const boxWidth = box.offsetWidth || 250;
    
    const wrapperWidth = editor.clientWidth;
    const wrapperHeight = editor.clientHeight;
    
    let targetLeft = caretPos.left;
    let targetTop = caretPos.top + 22;
    
    // Adjust horizontal position if it overflows right side
    if (targetLeft + boxWidth > wrapperWidth) {
        targetLeft = Math.max(10, wrapperWidth - boxWidth - 10);
    }
    
    // Adjust vertical position if it overflows bottom side (places box above caret)
    if (targetTop + boxHeight > wrapperHeight) {
        targetTop = Math.max(10, caretPos.top - boxHeight - 6);
    }
    
    box.style.left = `${targetLeft}px`;
    box.style.top = `${targetTop}px`;
}

function renderAutocompleteSelection() {
    const box = document.getElementById('autocomplete-box');
    const items = box.querySelectorAll('.autocomplete-item');
    items.forEach((item, idx) => {
        if (idx === autocompleteActiveIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function insertAutocompleteSelection() {
    if (autocompleteMatches.length === 0) return;
    const selectedChar = autocompleteMatches[autocompleteActiveIndex];
    
    const text = editor.value;
    const pos = editor.selectionStart;
    
    const textBeforeCursor = text.substring(0, pos);
    const lastOpenCurly = textBeforeCursor.lastIndexOf('{');
    
    // If it was a multicolor or color declaration, replace appropriately
    const tagContent = textBeforeCursor.substring(lastOpenCurly + 1);
    
    const isMulticolorInsertion = (selectedChar.name === "부분 합창");
    
    let replacement = '';
    if (selectedChar.name === "부분 합창") {
        replacement = `multicolor=}`;
    } else if (selectedChar.isMeta) {
        // Meta keywords like {공백} or {간주} are directly completed
        replacement = `${selectedChar.name}}`;
    } else if (tagContent.match(/^(?:color|컬러)=/i)) {
        replacement = `color=${selectedChar.name}}`;
    } else if (tagContent.match(/^(?:multicolor|mcolor|부분합창)=/i)) {
        const allNames = tagContent.replace(/^(?:multicolor|mcolor|부분합창)=/i, '').split(',');
        allNames[allNames.length - 1] = selectedChar.name;
        replacement = `multicolor=${allNames.join(', ')}`;
        
        // Add to active character list if not already
        if (!selectedChar.isSpecial && !selectedChar.isMeta) addActiveCharacter(selectedChar.name);
        
        // Do not close multicolor yet because they might add more, or close it if they select
        replacement += `}`;
    } else {
        // Raw open bracket `{`, replace with default `{color=name}`
        replacement = `color=${selectedChar.name}}`;
    }
    
    // Add selected character to active list automatically if it's a regular database character
    if (!selectedChar.isSpecial && !selectedChar.isMeta) {
        addActiveCharacter(selectedChar.name);
    }
    
    let textAfterCursor = text.substring(pos);
    const prefix = textBeforeCursor.substring(0, lastOpenCurly + 1);
    
    // 중복 닫는 중괄호 자동 소거 (Prevent duplicate closing curly brace)
    if (replacement.endsWith('}') && textAfterCursor.startsWith('}')) {
        textAfterCursor = textAfterCursor.substring(1);
    }
    
    commitPrevStateToUndo();
    editor.value = prefix + replacement + textAfterCursor;
    if (isMulticolorInsertion) {
        editor.selectionStart = editor.selectionEnd = prefix.length + replacement.length - 1; // Place cursor inside, before }
    } else {
        editor.selectionStart = editor.selectionEnd = prefix.length + replacement.length;
    }
    isTyping = false;
    capturePrevState();
    
    hideAutocomplete();
    updateRowNumbers();
    triggerRender();
}

function hideAutocomplete() {
    const box = document.getElementById('autocomplete-box');
    box.classList.add('hidden');
    autocompleteActiveIndex = 0;
    autocompleteMatches = [];
    autocompleteTagStartIndex = -1; // Reset index
}

// Helper to get caret coordinates inside standard textarea
function getCaretCoordinates(element, position) {
    const div = document.createElement('div');
    const style = window.getComputedStyle(element);
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = `${element.clientWidth}px`;
    div.style.height = `${element.clientHeight}px`;
    
    // Safe shield: copy only geometry and layout related styles to avoid read-only properties write exceptions
    const properties = [
        'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
        'textAlign', 'textTransform', 'textIndent', 'textDecoration',
        'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize'
    ];
    
    properties.forEach(prop => {
        try {
            if (style[prop] !== undefined && style[prop] !== null) {
                div.style[prop] = style[prop];
            }
        } catch (e) {
            // Silently absorb read-only write failures
        }
    });
    
    const text = element.value;
    div.textContent = text.substring(0, position);
    
    const span = document.createElement('span');
    span.textContent = text.substring(position) || '.';
    div.appendChild(span);
    
    document.body.appendChild(div);
    const coordinates = {
        top: span.offsetTop - element.scrollTop + element.offsetTop,
        left: span.offsetLeft - element.scrollLeft + element.offsetLeft
    };
    document.body.removeChild(div);
    
    return coordinates;
}

// --- SAMPLE LOADER ---
function initSampleLoader() {
    document.getElementById('btn-load-sample').addEventListener('click', async () => {
        try {
            isUserEditingStarted = true; // 샘플 가사 불러오기를 가동하였으므로 편집 세션 활성화
            const response = await fetch('/sample.json');
            if (!response.ok) {
                throw new Error(`Failed to load sample.json (Status: ${response.status})`);
            }
            const data = await response.json();
            
            // 1. 가사 텍스트를 에디터에 먼저 주입합니다. (동적 캐릭터 자동 제거 방지 선제 보호)
            undoStack = [];
            redoStack = [];
            isTyping = false;
            editor.value = data.lyrics || '';
            capturePrevState();
            hasUnsavedChanges = true;
            updateRowNumbers();
            
            // 2. 가사가 안착된 상태에서 가창 캐릭터들을 렌더 유예(skipRender=true) 옵션으로 안전하게 등재시킵니다.
            if (data.activeCharacters && Array.isArray(data.activeCharacters)) {
                data.activeCharacters.forEach(char => {
                    addActiveCharacter(char, true);
                });
            }
            
            // 3. 최종 완성 상태에서 즉시 프리뷰 렌더링을 딱 1회만 기동합니다.
            triggerRender();
        } catch (error) {
            console.error("Error loading sample lyrics:", error);
            showToast("샘플 가사를 불러오는 도중 오류가 발생했습니다.", "danger-bug");
        }
    });
}

// --- PROGRAM SETTINGS MODAL & ACCORDION ---
function initSettings() {
    const btnSettings = document.getElementById('btn-settings-floating');
    const modalSettings = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const accordionHeader = document.getElementById('settings-debug-header');
    
    // 0. 개발자 모드 연타 활성화 (안드로이드 스타일)
    let devModeClickCount = 0;
    let lastDevModeClickTime = 0;
    const devTrigger = document.getElementById('settings-dev-trigger');
    if (devTrigger) {
        devTrigger.addEventListener('click', () => {
            if (IS_DEV_MODE_ACTIVE) {
                showToast("이미 개발자 모드가 활성화되어 있습니다.", 'info');
                return;
            }
            const now = Date.now();
            if (now - lastDevModeClickTime > 1500) {
                devModeClickCount = 0;
            }
            lastDevModeClickTime = now;
            devModeClickCount++;

            if (devModeClickCount >= 4 && devModeClickCount < 10) {
                const remainingSteps = 10 - devModeClickCount;
                showToast(`개발자가 되려면 ${remainingSteps}단계 남았습니다.`, 'info');
            } else if (devModeClickCount >= 10) {
                IS_DEV_MODE_ACTIVE = true;
                applyDevModeUI();
                showToast("개발자 모드가 활성화되었습니다!", 'success');
                saveConfigOnServer();
            }
        });
    }

    // 1. 설정 모달 열기 및 단방향 UI 동기화
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            // 모달 내 인풋 값들을 전역 변수(CURRENT_THEME 등) 값으로 단방향 동기화
            const themeSelect = document.getElementById('settings-theme-select');
            if (themeSelect) themeSelect.value = CURRENT_THEME;
            
            // 다크 모드일 때만 리얼 블랙 옵션 노출
            const pureblackContainer = document.getElementById('settings-pureblack-container');
            if (pureblackContainer) {
                if (CURRENT_THEME === 'dark') {
                    pureblackContainer.classList.remove('hidden');
                } else {
                    pureblackContainer.classList.add('hidden');
                }
            }
            
            const pureblackToggle = document.getElementById('settings-pureblack-toggle');
            if (pureblackToggle) pureblackToggle.checked = IS_PURE_BLACK_ACTIVE;
            
            const tabSelect = document.getElementById('settings-default-tab');
            if (tabSelect) tabSelect.value = CURRENT_TAB;
            
            const fontSelect = document.getElementById('settings-font-select');
            if (fontSelect) fontSelect.value = CURRENT_FONT;
            
            const previewLoggerCheckbox = document.getElementById('settings-preview-logger');
            if (previewLoggerCheckbox) previewLoggerCheckbox.checked = IS_PREVIEW_LOGGER_ACTIVE;
            
            const textLoggerCheckbox = document.getElementById('settings-text-logger');
            if (textLoggerCheckbox) textLoggerCheckbox.checked = IS_TEXT_LOGGER_ACTIVE;
            
            if (modalSettings) modalSettings.classList.remove('hidden');
        });
    }
    
    // 2. 닫기 버튼 클릭 시에만 모달 닫기 (배경 클릭 닫기 비활성화)
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            if (modalSettings) modalSettings.classList.add('hidden');
        });
    }
    
    // 3. 디버깅 설정 아코디언 토글
    if (accordionHeader) {
        accordionHeader.addEventListener('click', () => {
            accordionHeader.classList.toggle('open');
        });
    }
    
    // 4. 테마 단방향 변경 이벤트
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            CURRENT_THEME = val;
            
            // 다크 모드일 때만 리얼 블랙 옵션 노출 (애니메이션 없이 즉시 노출/숨김)
            const pureblackContainer = document.getElementById('settings-pureblack-container');
            if (pureblackContainer) {
                if (val === 'dark') {
                    pureblackContainer.classList.remove('hidden');
                } else {
                    pureblackContainer.classList.add('hidden');
                }
            }
            
            applyTheme();
            renderActiveCharsBar();
            triggerRender();
            saveConfigOnServer();
        });
    }
    
    // 5. 기본 미리보기 형식 단방향 변경 이벤트
    const tabSelect = document.getElementById('settings-default-tab');
    if (tabSelect) {
        tabSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            CURRENT_TAB = val;
            
            applyTabState();
            triggerRender();
            saveConfigOnServer();
        });
    }
    
    // 6. 개별 디버그 로거 토글 이벤트
    const previewLoggerCheckbox = document.getElementById('settings-preview-logger');
    if (previewLoggerCheckbox) {
        previewLoggerCheckbox.addEventListener('change', (e) => {
            IS_PREVIEW_LOGGER_ACTIVE = e.target.checked;
            saveConfigOnServer();
        });
    }
    
    const textLoggerCheckbox = document.getElementById('settings-text-logger');
    if (textLoggerCheckbox) {
        textLoggerCheckbox.addEventListener('change', (e) => {
            IS_TEXT_LOGGER_ACTIVE = e.target.checked;
            saveConfigOnServer();
        });
    }

    // 7. 리얼 블랙 토글 이벤트
    const pureblackToggle = document.getElementById('settings-pureblack-toggle');
    if (pureblackToggle) {
        pureblackToggle.addEventListener('change', (e) => {
            IS_PURE_BLACK_ACTIVE = e.target.checked;
            applyTheme();
            renderActiveCharsBar();
            triggerRender();
            saveConfigOnServer();
        });
    }

    // 8. 에디터 글꼴 변경 이벤트
    const fontSelect = document.getElementById('settings-font-select');
    if (fontSelect) {
        fontSelect.addEventListener('change', (e) => {
            CURRENT_FONT = e.target.value;
            applyFont();
            saveConfigOnServer();
        });
    }

    // 9. 임시 알람 강제 호출 테스트 이벤트 (유형별 5종 + 이스터에그 밐빵이)
    const registerToastTestBtn = (id, msg, type) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                let actualMsg = msg;
                if (id === 'btn-test-toast-bug') {
                    // [웹 서버/로컬 앱 분기]
                    actualMsg = IS_DEV_MODE_ACTIVE 
                        ? '서버와 통신하는 도중 오류가 발생했습니다.' 
                        : '로컬 저장소를 읽거나 쓰는 도중 오류가 발생했습니다.';
                }
                showToast(actualMsg, type);
            });
        }
    };
    registerToastTestBtn('btn-test-toast-success', "'%20' 가사를 성공적으로 불러왔습니다!", 'success');
    // [웹 서버 환경 테스트 문구]
    // registerToastTestBtn('btn-test-toast-bug', '서버와 통신하는 도중 오류가 발생했습니다.', 'danger-bug');
    // [로컬 앱 환경 테스트 문구]
    registerToastTestBtn('btn-test-toast-bug', '로컬 저장소를 읽거나 쓰는 도중 오류가 발생했습니다.', 'danger-bug');
    registerToastTestBtn('btn-test-toast-user', '올바른 파일명을 입력해주세요.', 'danger-user');
    registerToastTestBtn('btn-test-toast-delete', "'%20' 데이터가 영구히 소멸하여 완전히 복구 불가능합니다.", 'danger-delete');
    registerToastTestBtn('btn-test-toast-info', "'%20' 단순 알림입니다.", 'info');
    registerToastTestBtn('btn-test-toast-kill', '당신은 밐빵이를 죽였습니다. 잔인한 사람.', 'danger-delete');

    // 10. QA용 강제종료 테스트 버튼 이벤트
    const btnForceExit = document.getElementById('btn-debug-force-exit');
    if (btnForceExit) {
        btnForceExit.addEventListener('click', async () => {
            await fetch('/api/force-exit').catch(() => {});
        });
    }
}

// --- NAMUMARK PATCHNOTES ENGINE & MODAL ---

function renderNamuMarkToElement(namuText, targetEl) {
    if (!targetEl) return;
    if (!namuText || !namuText.trim()) {
        targetEl.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">(작성된 패치노트 내용이 없습니다.)</span>';
        return;
    }

    if (typeof window.Namumark !== 'function') {
        targetEl.innerHTML = '<span style="color: var(--danger-color); font-size: 0.8rem;">나무마크 파서를 로드할 수 없습니다.</span>';
        return;
    }

    try {
        const docTitle = "patchnotes";
        const parser = new window.Namumark(docTitle, {
            allowedExternalImageExts: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
            wiki: {
                read: () => namuText,
                exists: () => true,
                resolveUrl: () => '#'
            }
        });
        parser.parse((err, result) => {
            if (err) {
                targetEl.innerHTML = `<span style="color: var(--danger-color); font-size: 0.8rem;">파싱 오류: ${err.message || err}</span>`;
                return;
            }
            let html = (result && result.html) ? result.html : '';
            // Strip auto-generated #wiki-toc anchor links and numbering from headings
            html = html.replace(/<a\s+href="#wiki-toc"[^>]*>[\s\S]*?<\/a>/gi, '');
            targetEl.innerHTML = html;
        });
    } catch (e) {
        targetEl.innerHTML = `<span style="color: var(--danger-color); font-size: 0.8rem;">파서 실행 예외: ${e.message || e}</span>`;
    }
}

function initPatchnotes() {
    const modalPatchnotes = document.getElementById('patchnotes-modal');
    const btnClosePatchnotes = document.getElementById('btn-close-patchnotes');
    const versionLink = document.getElementById('settings-version-link');
    const btnTogglePrev = document.getElementById('btn-toggle-prev-patchnotes');
    const togglePrevText = document.getElementById('toggle-prev-patchnotes-text');
    const prevContainer = document.getElementById('prev-patchnotes-container');
    const prevList = document.getElementById('prev-patchnotes-list');

    const badgeCurrent = document.getElementById('current-patchnote-badge');
    const dateCurrent = document.getElementById('current-patchnote-date');
    const titleCurrent = document.getElementById('current-patchnote-title');
    const contentCurrent = document.getElementById('current-patchnote-content');

    let isPrevOpen = false;

    async function openPatchnotes() {
        let data = [];
        try {
            const res = await fetch('/api/patchnotes');
            if (res.ok) {
                data = await res.json();
            }
        } catch (e) {
            console.error("Failed to load patchnotes from data/patchnotes.json:", e);
        }

        if (!Array.isArray(data) || data.length === 0) {
            if (Array.isArray(window.PATCHNOTES_DATA)) {
                data = window.PATCHNOTES_DATA;
            }
        }
        
        if (data.length > 0) {
            const latest = data[0];
            if (badgeCurrent) badgeCurrent.textContent = `v${latest.version} (최신)`;
            if (dateCurrent) dateCurrent.textContent = latest.date || '';
            if (titleCurrent) titleCurrent.textContent = latest.title || `v${latest.version} 릴리즈`;
            renderNamuMarkToElement(latest.content, contentCurrent);

            // 이전 버전 목록 생성
            if (prevList) {
                prevList.innerHTML = '';
                const prevVersions = data.slice(1);
                
                if (prevVersions.length === 0) {
                    prevList.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem; text-align: center;">이전 버전 내역이 없습니다.</div>';
                } else {
                    prevVersions.forEach((item, idx) => {
                        const card = document.createElement('div');
                        card.className = 'prev-patchnotes-item';
                        card.innerHTML = `
                            <div class="prev-patchnotes-header" data-idx="${idx}">
                                <div class="prev-patchnotes-header-left">
                                    <span class="patchnotes-badge-sub">v${item.version}</span>
                                    <span class="prev-patchnotes-title">${item.title || `v${item.version}`}</span>
                                </div>
                                <span class="patchnotes-date">${item.date || ''} ▾</span>
                            </div>
                            <div class="prev-patchnotes-body patchnotes-view hidden" id="prev-patchnote-body-${idx}"></div>
                        `;

                        const header = card.querySelector('.prev-patchnotes-header');
                        const body = card.querySelector('.prev-patchnotes-body');
                        const dateEl = header.querySelector('.patchnotes-date');

                        header.addEventListener('click', () => {
                            const isExpanded = !body.classList.contains('hidden');
                            if (isExpanded) {
                                body.classList.add('hidden');
                                dateEl.textContent = `${item.date || ''} ▾`;
                            } else {
                                body.classList.remove('hidden');
                                dateEl.textContent = `${item.date || ''} ▴`;
                                if (!body.dataset.rendered) {
                                    renderNamuMarkToElement(item.content, body);
                                    body.dataset.rendered = "true";
                                }
                            }
                        });

                        prevList.appendChild(card);
                    });
                }
            }
        } else {
            if (contentCurrent) {
                contentCurrent.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">등록된 패치노트가 없습니다.</span>';
            }
        }

        // 이전 버전 목록은 기본 접힘 상태로 리셋
        isPrevOpen = false;
        if (prevContainer) prevContainer.classList.add('hidden');
        if (togglePrevText) togglePrevText.textContent = '🔽 이전 버전 패치노트 보기';

        if (modalPatchnotes) modalPatchnotes.classList.remove('hidden');
    }

    function closePatchnotes() {
        if (modalPatchnotes) modalPatchnotes.classList.add('hidden');
    }

    if (versionLink) {
        versionLink.addEventListener('click', () => {
            openPatchnotes();
        });
    }

    if (btnClosePatchnotes) {
        btnClosePatchnotes.addEventListener('click', () => {
            closePatchnotes();
        });
    }

    if (modalPatchnotes) {
        modalPatchnotes.addEventListener('click', (e) => {
            if (e.target === modalPatchnotes) {
                closePatchnotes();
            }
        });
    }

    if (btnTogglePrev) {
        btnTogglePrev.addEventListener('click', () => {
            isPrevOpen = !isPrevOpen;
            if (isPrevOpen) {
                if (prevContainer) prevContainer.classList.remove('hidden');
                if (togglePrevText) togglePrevText.textContent = '🔼 이전 버전 패치노트 접기';
            } else {
                if (prevContainer) prevContainer.classList.add('hidden');
                if (togglePrevText) togglePrevText.textContent = '🔽 이전 버전 패치노트 보기';
            }
        });
    }

    // First run after update / fresh install check
    async function checkFirstRunPatchnotes() {
        const CURRENT_VERSION = "1.6.0";
        try {
            const lastSeenVersion = localStorage.getItem('last_seen_patchnotes_version');
            if (lastSeenVersion !== CURRENT_VERSION) {
                await openPatchnotes();
                localStorage.setItem('last_seen_patchnotes_version', CURRENT_VERSION);
            }
        } catch (e) {
            console.error("Failed to check last seen patchnotes version:", e);
        }
    }

    checkFirstRunPatchnotes();
}

// --- CORE PARSING & COMPILING ENGINE ---

// Parse text segments inside a line (supporting inline tags)
// Returns array of objects: { text: "...", charName: "...", style: char_object }
function parseLineSegments(lineText, fallbackChar) {
    if (!lineText) return [];
    
    const segments = [];
    let text = lineText.trim();
    
    // 1. Process inline structures first: {{{text{color=Name}}}}
    // Regex matches: {{{ (ANYTHING) {color/multicolor= (CHARACTER) } }}}
    const inlineRegex = /\{\{\{(.*?)\{(color|컬러|multicolor|mcolor|부분합창)=([^\}]+)\}\}\}\}/g;
    let match;
    let lastIndex = 0;
    
    while ((match = inlineRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        
        // Add leading segment sung by the fallback/previous character
        if (matchIndex > lastIndex) {
            const leadText = text.substring(lastIndex, matchIndex).trim();
            if (leadText) {
                segments.push({
                    text: leadText,
                    char: resolveCharacter(fallbackChar) || fallbackChar
                });
            }
        }
        
        const innerText = match[1];
        const tagType = match[2].toLowerCase();
        const innerCharId = match[3].trim();
        
        let resolved;
        let memberNames = null;
        if (["multicolor", "mcolor", "부분합창"].includes(tagType)) {
            resolved = resolveCharacter("부분 합창") || "부분 합창";
            memberNames = innerCharId.split(',').map(n => n.trim());
        } else {
            resolved = resolveCharacter(innerCharId) || innerCharId;
        }
        
        segments.push({
            text: innerText,
            char: resolved,
            members: memberNames
        });
        
        lastIndex = inlineRegex.lastIndex;
    }
    
    // Add trailing segment
    if (lastIndex < text.length) {
        const trailText = text.substring(lastIndex).trim();
        if (trailText) {
            segments.push({
                text: trailText,
                char: resolveCharacter(fallbackChar) || fallbackChar
            });
        }
    }
    
    // If no inline structure matched, look for sequential swaps: text{color=Name}
    if (segments.length === 0) {
        // Regex matches: (TEXT) {color/multicolor= (NAME) }
        const sequentialRegex = /([^{]+)\{(color|컬러|multicolor|mcolor|부분합창)=([^}]+)\}/g;
        lastIndex = 0;
        let lastChar = fallbackChar;
        
        while ((match = sequentialRegex.exec(text)) !== null) {
            const matchIndex = match.index;
            const segmentText = match[1].trim();
            const tagType = match[2].toLowerCase();
            const charId = match[3].trim();
            
            let resolved;
            let memberNames = null;
            if (["multicolor", "mcolor", "부분합창"].includes(tagType)) {
                resolved = resolveCharacter("부분 합창") || "부분 합창";
                memberNames = charId.split(',').map(n => n.trim());
            } else {
                resolved = resolveCharacter(charId) || charId;
            }
            
            segments.push({
                text: segmentText,
                char: resolved,
                members: memberNames
            });
            
            lastChar = ["multicolor", "mcolor", "부분합창"].includes(tagType) ? "부분 합창" : charId;
            lastIndex = sequentialRegex.lastIndex;
        }
        
        // Add trailing segment if any left without declaration
        if (lastIndex < text.length) {
            const trailText = text.substring(lastIndex).trim();
            if (trailText) {
                // If there's {multicolor=...} at the end, parse it!
                const mColorMatch = trailText.match(/\{(?:multicolor|mcolor|부분합창)=([^}]+)\}/i);
                if (mColorMatch) {
                    const resolved = resolveCharacter("부분 합창");
                    const memberNames = mColorMatch[1].split(',').map(n => n.trim());
                    segments.push({
                        text: trailText.replace(/\{.*\}/, '').trim(),
                        char: resolved || "부분 합창",
                        members: memberNames
                    });
                } else {
                    segments.push({
                        text: trailText,
                        char: resolveCharacter(lastChar) || lastChar
                    });
                }
            }
        }
    }
    
    // If no tags at all, the entire line belongs to fallback character
    if (segments.length === 0) {
        segments.push({
            text: text,
            char: resolveCharacter(fallbackChar) || fallbackChar
        });
    }
    
    return segments;
}

// Robust character-by-character State Machine Parser to auto-split columns (||)
// Bypasses complex regex bugs and safely handles nested braces like {{{lyric{color=Char}}}}
// Also gracefully handles mismatched trailing braces (e.g. {color=flower}}) and prevents index leakage
function parseLineToColumns(lineText, fallbackChar) {
    const columns = [];
    let text = lineText.trim();
    
    // 마크다운 역유입 오염 방지 필터 (Markdown Ingestion Safe Shield - V2)
    // 사용자가 컴파일된 나무위키 표 코드(|| ... ||)를 다시 에디터에 붙여넣을 때 파싱 오염을 차단하고 원본 가사 컬럼 복원
    if (text.startsWith('||')) {
        // 1. 맨 앞과 맨 뒤의 || 제거
        if (text.startsWith('||')) text = text.substring(2);
        if (text.endsWith('||')) text = text.substring(0, text.length - 2);
        text = text.trim();
        
        // 2. || 로 쪼개어 각 셀들을 추출
        const rawCells = text.split('||').map(c => c.trim());
        
        // 3. 각 셀을 파싱하여 컬럼 객체로 변환
        rawCells.forEach(cellText => {
            // 테이블 레벨 속성 및 가로 병합 태그 제거
            let cleanCell = cellText
                .replace(/<tablealign=[^>]+>/gi, '')
                .replace(/<tablebgcolor=[^>]+>/gi, '')
                .replace(/<tablecolor=[^>]+>/gi, '')
                .replace(/^<-\d+>/gi, '')
                .trim();
                
            // bgcolor, rowbgcolor, color 태그 추출 및 제거
            let cellBg = null;
            let cellTxt = null;
            
            const bgMatch = cleanCell.match(/<(?:bgcolor|rowbgcolor)=([^>]+)>/i);
            if (bgMatch) {
                cellBg = bgMatch[1].split(',')[0].trim().toLowerCase(); // Light 모드 색상 추출
                cleanCell = cleanCell.replace(/<(?:bgcolor|rowbgcolor)=[^>]+>/gi, '');
            }
            
            const txtMatch = cleanCell.match(/<color=([^>]+)>/i);
            if (txtMatch) {
                cellTxt = txtMatch[1].split(',')[0].trim().toLowerCase();
                cleanCell = cleanCell.replace(/<color=[^>]+>/gi, '');
            }
            
            cleanCell = cleanCell.trim();
            
            // 색상 백업이 있는 빈 셀의 경우 {공백} 복원 예외처리
            if (cleanCell === "") {
                if (cellBg === "#ffffff" || cellBg === "#1c1d1f") {
                    cleanCell = "{공백}";
                }
            }
            
            // 색상 값을 기반으로 캐릭터 역추적 (Reverse lookup)
            let matchedChar = null;
            if (cellBg || cellTxt) {
                const allChars = [
                    ...Object.keys(SPECIAL_CHARACTERS).map(name => ({ name, ...SPECIAL_CHARACTERS[name] })),
                    ...Object.keys(CHAR_DB).map(name => ({ name, ...CHAR_DB[name] }))
                ];
                
                for (const char of allChars) {
                    const c1Bg = char.color_1.bg.split(',')[0].trim().toLowerCase();
                    const c1Txt = char.color_1.txt.split(',')[0].trim().toLowerCase();
                    const c2Bg = char.color_2.bg.split(',')[0].trim().toLowerCase();
                    const c2Txt = char.color_2.txt.split(',')[0].trim().toLowerCase();
                    
                    if ((cellBg && (cellBg === c1Bg || cellBg === c2Bg)) ||
                        (cellTxt && (cellTxt === c1Txt || cellTxt === c2Txt))) {
                        matchedChar = char;
                        break;
                    }
                }
            }
            
            const finalChar = matchedChar || resolveCharacter(fallbackChar) || fallbackChar;
            
            columns.push({
                text: cleanCell,
                char: finalChar
            });
        });
        
        // 최종 필터링: 텍스트가 아예 비어있는 무의미한 가상 컬럼은 컴파일 표 오염 방지를 위해 철저히 걸러낸다!
        return columns.filter(col => col.text && col.text.trim() !== "");
    }
    
    // Normalize tags to {color=...}
    text = text.replace(/\{(?:컬러|color)=([^}]+)\}/gi, '{color=$1}');
    text = text.replace(/\{(?:multicolor|mcolor|부분합창)=([^}]+)\}/gi, '{multicolor=$1}');
    
    let i = 0;
    let currentText = '';
    let currentLastChar = fallbackChar;
    let currentLastMembers = null;
    
    while (i < text.length) {
        // 1. Detect temporary participant block: {{{lyric{color=Char}}}}
        if (text.substring(i, i + 3) === '{{{') {
            const remainingText = text.substring(i);
            const tempBlockMatch = remainingText.match(/^\{\{\{([\s\S]*?)\{(color|컬러|multicolor|mcolor|부분합창)=([^}]+)\}\}\}\}/i);
            if (tempBlockMatch) {
                const lyric = tempBlockMatch[1].trim();
                const tagType = tempBlockMatch[2].toLowerCase();
                const charName = tempBlockMatch[3].trim();
                
                let resolvedChar;
                let memberNames = null;
                if (["multicolor", "mcolor", "부분합창"].includes(tagType)) {
                    resolvedChar = resolveCharacter("부분 합창") || "부분 합창";
                    memberNames = charName.split(',').map(n => n.trim());
                } else {
                    resolvedChar = resolveCharacter(charName) || charName;
                }
                
                // 일시 개입 앞쪽 누적 텍스트는 이전 가창자 컨텍스트(currentLastChar)의 몫
                if (currentText.trim() !== '') {
                    columns.push({
                        text: currentText.trim(),
                        char: resolveCharacter(currentLastChar) || currentLastChar,
                        members: currentLastChar === "부분 합창" ? currentLastMembers : null
                    });
                    currentText = '';
                }
                
                // 일시 개입 자체를 독립 컬럼으로 방출
                columns.push({
                    text: lyric,
                    char: resolvedChar,
                    members: memberNames,
                    isTemporary: true
                });
                
                i += tempBlockMatch[0].length;
                continue;
            }
        }
        
        // 2. Detect sequential tag: {color=Char}
        if (text[i] === '{') {
            const closingBrace = text.indexOf('}', i);
            if (closingBrace !== -1) {
                const tagContent = text.substring(i + 1, closingBrace);
                const colorMatch = tagContent.match(/^color=([^}]+)$/i);
                const multicolorMatch = tagContent.match(/^(?:multicolor|mcolor|부분합창)=([^}]+)$/i);
                
                if (colorMatch) {
                    const charName = colorMatch[1].trim();
                    const resolvedChar = resolveCharacter(charName) || charName;
                    
                    // 핵심: 태그 직전까지 누적된 텍스트의 가창자는 이 태그의 캐릭터(resolvedChar)이다!
                    if (currentText.trim() !== '') {
                        columns.push({
                            text: currentText.trim(),
                            char: resolvedChar
                        });
                        currentText = '';
                    }
                    
                    currentLastChar = charName; // Update active character context
                    
                    i = closingBrace + 1;
                    // Skip any mismatched/extra trailing braces (e.g. {color=flower}})
                    while (i < text.length && text[i] === '}') {
                        i++;
                    }
                    continue;
                } else if (multicolorMatch) {
                    const resolvedChar = resolveCharacter("부분 합창") || "부분 합창";
                    const memberNames = multicolorMatch[1].split(',').map(n => n.trim());
                    
                    // 핵심: 태그 직전까지 누적된 텍스트의 가창자는 부분 합창 캐릭터이다!
                    if (currentText.trim() !== '') {
                        columns.push({
                            text: currentText.trim(),
                            char: resolvedChar,
                            members: memberNames
                        });
                        currentText = '';
                    }
                    
                    currentLastChar = "부분 합창";
                    currentLastMembers = memberNames;
                    
                    i = closingBrace + 1;
                    // Skip any mismatched/extra trailing braces
                    while (i < text.length && text[i] === '}') {
                        i++;
                    }
                    continue;
                }
            }
        }
        
        // 3. Normal character accumulator
        currentText += text[i];
        i++;
    }
    
    // 줄 끝 잔여 텍스트는 이전 가창자 컨텍스트(currentLastChar)의 몫
    if (currentText.trim() !== '') {
        const mColorMatch = currentText.match(/\{(?:multicolor|mcolor|부분합창)=([^}]+)\}/i);
        if (mColorMatch) {
            const resolved = resolveCharacter("부분 합창");
            const memberNames = mColorMatch[1].split(',').map(n => n.trim());
            columns.push({
                text: currentText.replace(/\{.*\}/, '').trim(),
                char: resolved || "부분 합창",
                members: memberNames
            });
        } else {
            columns.push({
                text: currentText.trim(),
                char: resolveCharacter(currentLastChar) || currentLastChar,
                members: currentLastChar === "부분 합창" ? currentLastMembers : null
            });
        }
    }
    
    // 최종 방어막 (Ingestion Safe Shield):
    // 텍스트가 비어있거나 무의미한 공백뿐인 가상 컬럼은 컴파일 표 정렬 오염을 방지하기 위해 정밀 필터링하여 제거한다!
    return columns.filter(col => col.text && col.text.trim() !== "");
}

// Calculates precise column spans dynamically based on target character positions within the active list
function calculateSpans(columns, activeList, N) {
    const C = columns.length;
    if (C === 0) return [];
    if (C === 1) return [N];
    if (C === N) return Array(C).fill(1);
    
    // N > C (e.g. N = 3, C = 2)
    // Find preferred layout index for each parsed column
    const preferred = columns.map((col, idx) => {
        const charName = (col.char && typeof col.char === 'object') ? col.char.name : col.char;
        if (!charName) return idx;
        if (["전체 합창", "부분 합창", "영상 자막", "나레이션"].includes(charName)) {
            return idx === 0 ? 0 : N - 1;
        }
        const activeIdx = activeList.indexOf(charName);
        return activeIdx !== -1 ? Math.min(activeIdx, N - 1) : idx;
    });
    
    // Bound divide algorithm: column i takes [boundaries[i], boundaries[i+1]] interval
    const boundaries = Array(C + 1).fill(0);
    boundaries[0] = 0;
    boundaries[C] = N;
    
    for (let i = 1; i < C; i++) {
        const leftPref = preferred[i - 1];
        const rightPref = preferred[i];
        boundaries[i] = Math.max(leftPref + 1, Math.min(rightPref, i));
    }
    
    const spans = [];
    for (let i = 0; i < C; i++) {
        spans.push(boundaries[i + 1] - boundaries[i]);
    }
    
    // Ensure all spans are at least 1 to prevent columns from being collapsed/lost (Safe Shield V3)
    if (spans.some(s => s <= 0)) {
        let rem = N;
        for (let i = 0; i < C; i++) {
            spans[i] = Math.max(1, Math.floor(N / C));
            rem -= spans[i];
        }
        if (rem > 0 && spans.length > 0) {
            spans[spans.length - 1] += rem;
        } else if (rem < 0) {
            for (let i = C - 1; i >= 0 && rem < 0; i--) {
                const take = Math.min(-rem, spans[i] - 1);
                spans[i] -= take;
                rem += take;
            }
        }
    }
    
    return spans;
}

// Parses raw editor text into structured blocks/stanzas
function parseLyrics(rawText) {
    if (!rawText.trim()) return [];
    
    // 1. 임시 참가자 구문({{{...}}})을 제외한 본문에서 정식(일반) 가창자 목록을 정밀 수집
    const cleanTextForFormal = rawText.replace(/\{\{\{[\s\S]*?\}\}\}/g, '');
    const formalNames = new Set();
    const formalTagRegex = /\{(?:color|컬러|multicolor|mcolor|부분합창)=([^}]+)\}/gi;
    let formalMatch;
    while ((formalMatch = formalTagRegex.exec(cleanTextForFormal)) !== null) {
        const val = formalMatch[1].trim();
        if (val.includes(',')) {
            val.split(',').map(n => n.trim()).forEach(m => {
                const resolved = resolveCharacter(m);
                if (resolved && !resolved.isSpecial) {
                    formalNames.add(resolved.name);
                }
            });
        } else {
            const resolved = resolveCharacter(val);
            if (resolved && !resolved.isSpecial) {
                formalNames.add(resolved.name);
            }
        }
    }
    const isMultipleFormalActive = formalNames.size > 1;
    
    // Split by empty lines
    const rawStanzas = rawText.split(/\n\s*\n/);
    const parsedStanzas = [];
    
    let lastDeclaredChar = DEFAULT_CHARACTER || ACTIVE_CHARACTERS[0] || null; // Track character context (3-1-5, 3-1-2)
    const inheritLastChar = document.getElementById('opt-inherit-character').checked;
    
    rawStanzas.forEach((stanzaText, stanzaIdx) => {
        const lines = stanzaText.split('\n').map(l => l.trim()).filter(l => l !== "");
        if (lines.length === 0) return;
        
        // Detect stanza-level character declarations on the first line
        // E.g., 원문가사1{color=캐릭터1} or 원문가사1{color=전체 합창}
        const firstLine = lines[0];
        
        // 중괄호 세 개 {{{ ... }}} 로 감싸진 임시 개입 구문을 제거한 정제 줄을 만듭니다. (일시 개입 가창자의 디폴트 표 색상 오염 방어)
        const cleanFirstLine = firstLine.replace(/\{\{\{[\s\S]*?\}\}\}/g, '');
        
        // Find the FIRST color tag declared in the clean line as the primary stanza character
        const regex = /\{(?:color|컬러)=([^}]+)\}/gi;
        const firstColorMatch = regex.exec(cleanFirstLine);
        
        const mColorMatch = firstLine.match(/\{(?:multicolor|mcolor|부분합창)=([^}]+)\}/i);
        
        let stanzaChar = lastDeclaredChar; // Default to inheriting
        let stanzaMembers = [];
        
        if (firstColorMatch) {
            stanzaChar = firstColorMatch[1].trim();
            lastDeclaredChar = stanzaChar; // Set context
        } else if (mColorMatch) {
            stanzaChar = "부분 합창";
            stanzaMembers = mColorMatch[1].split(',').map(n => n.trim());
            lastDeclaredChar = stanzaChar;
        } else {
            // No character declared on this stanza
            if (!inheritLastChar && ACTIVE_CHARACTERS.length > 1 && stanzaIdx > 0) {
                // If inheritance is disabled and there are multiple characters, flag error later
                stanzaChar = null;
            }
        }
        
        // Track the last original (first line in 3-line set) columns to inherit character properties symmetrically
        // This is robust against pasted continuous markdown table codes that lack empty lines
        let lastOriginalParsedCols = null;
        
        const parsedLines = lines.map((line, lineIdx) => {
            // 실시간 가창 맥락(lastDeclaredChar)을 기본 폴백 캐릭터로 지정
            let fallback = lastDeclaredChar || DEFAULT_CHARACTER || ACTIVE_CHARACTERS[0];
            
            // 상속 옵션(opt-inherit-character)이 비활성화되었고(inheritLastChar == false),
            // 명시적 가창 선언이 누락되었을 때:
            if (!stanzaChar && !inheritLastChar && ACTIVE_CHARACTERS.length > 1 && stanzaIdx > 0) {
                if (isMultipleFormalActive) {
                    // 정식 일반 참가 가창자가 곡 전체에 2명 이상("듀엣/그룹" 곡)이라면,
                    // 상속을 끊고 대표 캐릭터 기본 적용권도 배제하여 무조건 "미지정" 색상으로 처리합니다.
                    fallback = null;
                } else {
                    // 정식 가창자는 1명뿐이고 나머지는 임시 가창자인 상황(피쳐링 곡 등)이라면,
                    // 상속은 차단하되 실질적 대표 캐릭터(미쿠)로 안전하게 폴백합니다.
                    fallback = DEFAULT_CHARACTER || ACTIVE_CHARACTERS[0] || null;
                }
            }
            
            // Parse line into columns using state-machine parser
            const columns = parseLineToColumns(line, fallback);
            
            // Determine if this is an original lyric line (first line of stanza, or color-1 matching row in a pasted table)
            let isOriginalLine = (lineIdx === 0);
            
            // If pasted markdown table, we can identify original lines by checking if the rowbgcolor or bgcolor
            // matches Color 1 of database characters instead of Color 2.
            if (line.trim().startsWith('||') && lineIdx > 0) {
                // Check if any cell in the pasted line has a Color 1 background
                const cleanLine = line.replace(/^\|\|/, '').replace(/\|\|$/, '').trim();
                const cells = cleanLine.split('||').map(c => c.trim());
                
                let hasColor1 = false;
                for (const cell of cells) {
                    const bgMatch = cell.match(/<(?:bgcolor|rowbgcolor)=([^>]+)>/i);
                    if (bgMatch) {
                        const cellBg = bgMatch[1].split(',')[0].trim().toLowerCase();
                        
                        // Search for matching Color 1 in DB
                        const allChars = [
                            ...Object.keys(SPECIAL_CHARACTERS).map(name => ({ name, ...SPECIAL_CHARACTERS[name] })),
                            ...Object.keys(CHAR_DB).map(name => ({ name, ...CHAR_DB[name] }))
                        ];
                        for (const char of allChars) {
                            const c1Bg = char.color_1.bg.split(',')[0].trim().toLowerCase();
                            if (cellBg === c1Bg) {
                                hasColor1 = true;
                                break;
                            }
                        }
                    }
                    if (hasColor1) break;
                }
                
                if (hasColor1) {
                    isOriginalLine = true;
                }
            }
            
            // If it's not detected as original line, but we have 3-line cycle (lineIdx % 3 === 0), also mark as original
            if (!isOriginalLine && lineIdx % 3 === 0) {
                isOriginalLine = true;
            }
            
            // 만약 stanzaChar가 아직 null이고, 이 줄이 원문 줄(isOriginalLine)이라면,
            // 이 줄의 첫 번째 셀에서 식별된 가창자 캐릭터를 즉시 이 스탠자의 대표 캐릭터(stanzaChar) 및 글로벌 문맥(lastDeclaredChar)으로 자동 등극시킵니다!
            if (!stanzaChar && isOriginalLine && columns[0] && columns[0].char) {
                const resolved = typeof columns[0].char === 'object' ? columns[0].char.name : columns[0].char;
                stanzaChar = resolved;
                lastDeclaredChar = resolved;
            }
            
            if (isOriginalLine) {
                lastOriginalParsedCols = columns;
            } else if (lastOriginalParsedCols && columns.length === lastOriginalParsedCols.length) {
                // Symmetric Character Inheritance:
                // Symmetrically map the respective character of last original line's columns to subsequent translation lines
                columns.forEach((col, colIdx) => {
                    col.char = lastOriginalParsedCols[colIdx].char;
                });
            }
            
            const parsedCols = columns.map(col => {
                return {
                    raw: col.text,
                    members: col.members, // Preserve members!
                    segments: [
                        {
                            text: col.text,
                            char: col.char
                        }
                    ]
                };
            });
            
            // Fallback: If no columns parsed somehow, keep original line
            if (parsedCols.length === 0) {
                parsedCols.push({
                    raw: line,
                    segments: [{ text: line, char: fallback }]
                });
            }
            
            // 단락 내 마지막 유효 가창자로 lastDeclaredChar를 갱신하여 상속 맥락 완벽 동기화 (임시 참가 컬럼 배제)
            columns.forEach(col => {
                if (!col.isTemporary) {
                    let colChar = col.char;
                    if (colChar) {
                        if (typeof colChar !== 'object') {
                            colChar = resolveCharacter(colChar);
                        }
                        if (colChar && typeof colChar === 'object' && !colChar.isSpecial) {
                            lastDeclaredChar = colChar.name;
                        }
                    }
                }
            });
            
            return {
                raw: line,
                columns: parsedCols
            };
        });
        
        const hasInheritError = (!stanzaChar && !inheritLastChar && ACTIVE_CHARACTERS.length > 1 && stanzaIdx > 0);
        
        parsedStanzas.push({
            lines: parsedLines,
            charContext: resolveCharacter(stanzaChar) || stanzaChar,
            members: stanzaMembers,
            hasInheritError: hasInheritError
        });
    });
    
    return parsedStanzas;
}

// Automatically extract and sync active characters based on raw text to prevent timing sync lag
function autoSyncActiveCharacters(rawText, isUserEdit = false) {
    // 1. 가사 에디터 본문이 완전히 비어 있거나 공백뿐일 때는,
    // 사용자가 가사 입력 전에 수동으로 기용한 가창 대기 캐릭터들이 자동 소멸되지 않도록 제거 동기화를 우회합니다.
    // 단, 사용자가 직접 에디터를 지워서 비운 경우(isUserEdit = true)에는 캐릭터 목록도 리셋합니다.
    if (!rawText || !rawText.trim()) {
        if (isUserEdit) {
            if (ACTIVE_CHARACTERS.length > 0 || DEFAULT_CHARACTER !== null) {
                ACTIVE_CHARACTERS = [];
                DEFAULT_CHARACTER = null;
                renderActiveCharsBar();
            }
            LAST_DETECTED_CHARACTERS.clear();
        }
        return;
    }

    const detectedNames = new Set();
    
    // 가사 본문에서 직접 명시적 가창 태그 {color=...} 및 {multicolor=...} 를 정밀 추출하여
    // 상속 유령 가창자가 감지된 이름에 오염 난입하는 현상을 원천 차단합니다.
    const tagRegex = /\{(?:color|컬러|multicolor|mcolor|부분합창)=([^}]+)\}/gi;
    let match;
    while ((match = tagRegex.exec(rawText)) !== null) {
        const value = match[1].trim();
        if (value.includes(',')) {
            // 다중 가창자(multicolor) 선언 파싱
            const members = value.split(',').map(n => n.trim());
            members.forEach(m => {
                const resolved = resolveCharacter(m);
                if (resolved && !resolved.isSpecial) {
                    detectedNames.add(resolved.name);
                }
            });
        } else {
            const resolved = resolveCharacter(value);
            if (resolved && !resolved.isSpecial) {
                detectedNames.add(resolved.name);
            }
        }
    }
    
    // 양방향 자동 제거 동기화 및 대표 캐릭터(DEFAULT_CHARACTER) 왕위 계승 처리
    let updated = false;
    
    // 1. 에디터에서 사라진 캐릭터 필터링 격리
    // '이전 가사 텍스트에 감지되었으나 현재 가사 텍스트에는 감지되지 않는' 캐릭터만 제거 대상으로 취급
    const charactersToRemove = [];
    LAST_DETECTED_CHARACTERS.forEach(name => {
        if (!detectedNames.has(name)) {
            charactersToRemove.push(name);
        }
    });
    
    if (charactersToRemove.length > 0) {
        charactersToRemove.forEach(name => {
            if (DEFAULT_CHARACTER === name) {
                // 대표 지정 속성을 목록에 남은 차기 캐릭터 (캐릭터 2번) 에게 양도!
                const remaining = ACTIVE_CHARACTERS.filter(n => n !== name);
                if (remaining.length > 0) {
                    DEFAULT_CHARACTER = remaining[0];
                } else {
                    DEFAULT_CHARACTER = null;
                }
            }
            ACTIVE_CHARACTERS = ACTIVE_CHARACTERS.filter(n => n !== name);
            updated = true;
        });
    }
    
    // 2. 에디터에 새로 감지된 캐릭터 추가
    detectedNames.forEach(name => {
        if (!ACTIVE_CHARACTERS.includes(name)) {
            ACTIVE_CHARACTERS.push(name);
            updated = true;
        }
    });
    
    // LAST_DETECTED_CHARACTERS 상태 최신화
    LAST_DETECTED_CHARACTERS = detectedNames;
    
    if (updated) {
        renderActiveCharsBar();
    }
}

// Trigger render of Visual mock and Code markdown
function triggerRender(isUserEdit = false) {
    const raw = editor.value;

    // 초강력 이스터에그 워프 시스템: {color=밐빵이} 또는 {컬러=밐빵이}가 입력되는 즉시 팝업 없이 워프
    const hasWarpTag = raw.match(/\{(?:color|컬러)=밐빵이\}/i);
    if (hasWarpTag) {
        const alreadyWarped = sessionStorage.getItem('mikbbang_warped') === 'true';
        // 뒤로가기로 루프 도는 것을 세션 락으로 완벽 방어하며, 백스페이스 수정 중이 아닐 때만 즉각 워프 단행!
        if (!alreadyWarped && !isBackspaceActive) {
            sessionStorage.setItem('mikbbang_warped', 'true');
            if (window.__TAURI__ && window.__TAURI__.shell) {
                window.__TAURI__.shell.open("https://gall.dcinside.com/mini/board/lists/?id=mikbbang");
            } else {
                window.open("https://gall.dcinside.com/mini/board/lists/?id=mikbbang", "_blank");
            }
            return;
        }
    } else {
        // 문구가 에디터 상에서 지워지거나 변형되면 이스터에그 워프 락 봉인 해제(세션 초기화)
        sessionStorage.removeItem('mikbbang_warped');
    }
    
    // 1. Automatically register and sync detected characters to active badge list in real-time first!
    autoSyncActiveCharacters(raw, isUserEdit);
    
    // 2. Parse lyrics using the updated active character list
    const parsed = parseLyrics(raw);
    
    // 3. Compile and display Namuwiki markdown code first
    renderMarkdownOutput(parsed);
    
    // 4. Fetch the compiled markdown code
    const md = document.getElementById('markdown-output').value;
    
    // 5. Parse and render visual preview using Namumark JS engine
    renderVisualPreview(md);
    
    // 6. 가창자 선언 누락 경고 배지(Error Alert Card) 실시간 동적 주입 및 검증 (제거됨)
    
    // 7. 실시간 가사 텍스트 및 변환된 나무마크 코드 백엔드 디버깅 로거 전송 (전송 필터링 대응)
    if (IS_TEXT_LOGGER_ACTIVE) {
        fetch('/api/log-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawText: raw, markdownCode: md })
        }).catch(err => console.warn("Real-time text logging offline:", err));
    }
}

// --- RENDER VISUAL TABLE PREVIEW USING DYNAMIC NAMUMARK ENGINE ---
function renderVisualPreview(md) {
    const container = document.getElementById('namu-visual-renderer');
    if (!md || !md.trim()) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📝</span>
                <p>왼쪽 에디터에 가사를 입력하시면<br>실시간 나무마크 프리뷰가 이곳에 렌더링됩니다.</p>
            </div>
        `;
        return;
    }
    
    // Premium localized diagnostic error card rendering engine & Real-time Telemetry Client Logger
    function renderErrorCard(code, type, message, stack = "") {
        // Transmit diagnostic telemetries to backend HTTP server cleanly (전송 필터링 대응)
        if (IS_PREVIEW_LOGGER_ACTIVE) {
            fetch('/api/log-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, type, message, stack })
            }).catch(e => console.warn("Failed to transmit diagnostics to backend server:", e));
        }

        const stackHtml = stack ? `
            <div class="error-stack-wrapper">
                <span class="stack-label">🔧 디버그 스택 트레이스:</span>
                <pre class="error-stack">${stack}</pre>
            </div>
        ` : '';
        
        container.innerHTML = `
            <div class="error-card">
                <div class="error-card-header">
                    <span class="error-icon">⚠️</span>
                    <div class="error-title-group">
                        <span class="error-code">${code}</span>
                        <h3>프리뷰 렌더링 로딩 실패</h3>
                    </div>
                </div>
                <div class="error-card-body">
                    <p class="error-message">${message}</p>
                    <div class="error-meta">
                        <span class="meta-item"><strong>예외 유형:</strong> ${type}</span>
                        <span class="meta-item"><strong>발생 범위:</strong> Browser Sandbox</span>
                    </div>
                    ${stackHtml}
                    <div class="error-actions">
                        <button onclick="location.reload()" class="btn btn-secondary btn-sm">🔄 새로고침</button>
                        <button onclick="triggerRender()" class="btn btn-primary btn-sm">⚡ 재시도</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    try {
        // 1. Guard against Namumark compiler not being loaded at all
        if (typeof window.Namumark !== 'function') {
            renderErrorCard(
                "ERR_NAMUMARK_NOT_FOUND",
                "ReferenceError",
                "나무마크(Namumark) 렌더링 코어 라이브러리를 브라우저에서 찾을 수 없거나 아직 로드되지 않았습니다. 번들 스크립트(namumark.js)의 로드 상태 및 구문 오류 여부를 검사해 주세요."
            );
            return;
        }
        
        const docTitle = "lyrics";
        const parser = new window.Namumark(docTitle, {
            allowedExternalImageExts: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
            wiki: {
                read: (title) => md,
                exists: (title) => true,
                resolveUrl: (target, type) => '#'
            }
        });
        
        // 2. Wrap parser.parse callbacks safely and print stack trace on parser crash
        parser.parse((err, result) => {
            if (err) {
                console.error("Namumark parsing error:", err);
                renderErrorCard(
                    "ERR_PARSER_CRASH",
                    err.name || "ParserError",
                    `가사 마크다운을 나무마크 HTML 코드로 해석 및 변환하는 도중 파서 내부에서 예외가 발생했습니다: ${err.message}`,
                    err.stack || ""
                );
                return;
            }
            container.innerHTML = result.html;
        });
    } catch (e) {
        console.error("Namumark execution failed:", e);
        // 3. Gracefully absorb execution-level run exceptions
        renderErrorCard(
            "ERR_EXECUTION_FAILED",
            e.name || "RuntimeError",
            `프리뷰 렌더러를 초기화하고 해석기를 가동하는 도중 예기치 못한 런타임 오류가 터졌습니다: ${e.message}`,
            e.stack || ""
        );
    }
}

// --- GENERATE RAW NAMUwiki MARKDOWN CODE ---
function renderMarkdownOutput(stanzas) {
    const output = document.getElementById('markdown-output');
    if (stanzas.length === 0) {
        output.value = '';
        return;
    }
    
    // Find N (maximum columns) and maxLinesPerStanza
    let N = 1;
    let maxLinesPerStanza = 1;
    stanzas.forEach(s => {
        let actualLineCount = 0;
        s.lines.forEach(l => {
            if (l.columns.length > N) N = l.columns.length;
            
            const rawCol = l.columns[0]?.raw?.trim()?.toLowerCase();
            const isBlankLine = l.columns.length === 1 && (rawCol === '{공백}' || rawCol === '{blank}');
            const isInstrumentalLine = l.columns.length === 1 && (rawCol === '{간주}' || rawCol === '{instrumental}');
            
            if (!isBlankLine && !isInstrumentalLine) {
                actualLineCount++;
            }
        });
        if (actualLineCount > maxLinesPerStanza) {
            maxLinesPerStanza = actualLineCount;
        }
    });
    
    // Find the default character of the entire table (first cell's character)
    const firstStanza = stanzas[0];
    const defaultChar = firstStanza && firstStanza.charContext;
    const defaultCharName = (defaultChar && typeof defaultChar === 'object') ? defaultChar.name : null;
    
    // Build Namuwiki Markdown Code
    let md = '';
    
    stanzas.forEach((stanza, stanzaIdx) => {
        const char = stanza.charContext;
        const currentCharName = (char && typeof char === 'object') ? char.name : null;
        const isDefaultChar = (currentCharName === defaultCharName);
        
        let c1_bg = "#000000,#000000";
        let c1_txt = "#ffffff,#ffffff";
        let c2_bg = "#ffffff,#ffffff";
        let c2_txt = "#212529,#ffffff";
        
        if (char && typeof char === 'object') {
            c1_bg = char.color_1.bg;
            c1_txt = char.color_1.txt;
            c2_bg = char.color_2.bg;
            c2_txt = char.color_2.txt;
        }
        
        // Define default table colors for table-level properties (Stanza 0, line 0, col 0)
        const defaultTableBg = maxLinesPerStanza === 1 ? c1_bg : c2_bg;
        const defaultTableTxt = maxLinesPerStanza === 1 ? c1_txt : c2_txt;
        
        stanza.lines.forEach((line, lineIdx) => {
            // Check if the entire line is a 공백 or instrumental separator declared explicitly
            const rawCol = line.columns[0]?.raw?.trim()?.toLowerCase();
            const isBlankLine = line.columns.length === 1 && (rawCol === '{공백}' || rawCol === '{blank}');
            const isInstrumentalLine = line.columns.length === 1 && (rawCol === '{간주}' || rawCol === '{instrumental}');
            
            if (isBlankLine) {
                const spanPrefix = N > 1 ? `<-${N}>` : '';
                let tableHeader = '';
                if (stanzaIdx === 0 && lineIdx === 0) {
                    tableHeader = `<tablealign=center><tablebgcolor=${defaultTableBg}><tablecolor=${defaultTableTxt}>`;
                }
                md += `||${spanPrefix}${tableHeader}<bgcolor=#ffffff,#1c1d1f> ||\n`;
                return;
            }
            if (isInstrumentalLine) {
                const spanPrefix = N > 1 ? `<-${N}>` : '';
                let tableHeader = '';
                if (stanzaIdx === 0 && lineIdx === 0) {
                    tableHeader = `<tablealign=center><tablebgcolor=${defaultTableBg}><tablecolor=${defaultTableTxt}>`;
                }
                md += `||${spanPrefix}${tableHeader}<bgcolor=#ffffff,#1c1d1f>　||\n`;
                return;
            }
            
            // Calculate column spans dynamically for current line
            const spans = calculateSpans(line.columns, ACTIVE_CHARACTERS, N);
            
            // 1. 이 행의 첫 번째 셀의 가창 캐릭터 색상 2 정보 실시간 추적
            const firstCol = line.columns[0];
            let firstColChar = firstCol?.segments[0]?.char;
            if (typeof firstColChar !== 'object') {
                firstColChar = resolveCharacter(firstColChar) || firstColChar;
            }
            let firstTargetChar = firstColChar;
            if (!firstTargetChar || typeof firstTargetChar !== 'object') {
                firstTargetChar = char; // Stanza 대표 캐릭터
            }
            
            let firstColBg = "";
            let firstColTxt = "";
            if (firstTargetChar && typeof firstTargetChar === 'object') {
                firstColBg = firstTargetChar.color_2.bg;
                firstColTxt = firstTargetChar.color_2.txt;
            } else {
                firstColBg = c2_bg;
                firstColTxt = c2_txt;
            }
            
            // 2. 이 행의 기본 상속 배경색을 테이블 기본 배경색으로 초기화
            let currentInheritedBg = defaultTableBg;
            
            md += `||`;
            
            // Generate each column
            line.columns.forEach((col, colIdx) => {
                if (colIdx > 0) md += ` ||`;
                
                const span = spans[colIdx] || 1;
                const spanPrefix = span > 1 ? `<-${span}>` : '';
                md += spanPrefix;
                
                // Add table-level alignment properties only on the very first cell of the entire table
                if (stanzaIdx === 0 && lineIdx === 0 && colIdx === 0) {
                    md += `<tablealign=center><tablebgcolor=${defaultTableBg}><tablecolor=${defaultTableTxt}>`;
                }
                
                // Determine styling and colors for the cell
                let colChar = col.segments[0]?.char;
                if (typeof colChar !== 'object') {
                    colChar = resolveCharacter(colChar) || colChar;
                }
                
                let targetChar = colChar;
                if (!targetChar || typeof targetChar !== 'object') {
                    targetChar = char; // Fallback to stanza character
                }
                
                let colBg = "";
                let colTxt = "";
                let hasCellAttributes = false;
                
                if (lineIdx === 0) {
                    // 원문 줄 (lineIdx === 0): 각 셀 고유 캐릭터의 Color 1 적용
                    if (targetChar && typeof targetChar === 'object') {
                        colBg = targetChar.color_1.bg;
                        colTxt = targetChar.color_1.txt;
                    } else {
                        colBg = c1_bg;
                        colTxt = c1_txt;
                    }
                    
                    const bgAttr = colIdx === 0 ? 'rowbgcolor' : 'bgcolor';
                    md += `<${bgAttr}=${colBg}><color=${colTxt}> `;
                    hasCellAttributes = true;
                } else {
                    // 발음/번역 줄 (lineIdx > 0): 각 셀 고유 캐릭터의 Color 2 적용
                    if (targetChar && typeof targetChar === 'object') {
                        colBg = targetChar.color_2.bg;
                        colTxt = targetChar.color_2.txt;
                    } else {
                        colBg = c2_bg;
                        colTxt = c2_txt;
                    }
                    
                    // 정교한 상속 최적화 (Safe Shield V2 Style):
                    let isBgDifferent = false;
                    let isTxtDifferent = false;
                    
                    if (colIdx === 0) {
                        // 행의 첫 번째 셀(colIdx === 0): 테이블 디폴트 가창자와 다르면 무조건 rowbgcolor 강제 선언!
                        const isColDefaultChar = (targetChar && typeof targetChar === 'object' && targetChar.name === defaultCharName);
                        if (!isColDefaultChar) {
                            isBgDifferent = true;
                            currentInheritedBg = colBg; // 이 행의 상속 배경색을 첫 번째 셀의 배경색으로 업데이트!
                        }
                        isTxtDifferent = (colTxt !== defaultTableTxt);
                    } else {
                        // 두 번째 이후 셀(colIdx > 0): 실시간 상속 배경색 및 테이블 디폴트 글자색과 다를 때만 명시 선언!
                        isBgDifferent = (colBg !== currentInheritedBg);
                        isTxtDifferent = (colTxt !== defaultTableTxt);
                    }
                    
                    if (isBgDifferent || isTxtDifferent) {
                        const bgAttr = colIdx === 0 ? 'rowbgcolor' : 'bgcolor';
                        if (isBgDifferent && isTxtDifferent) {
                            md += `<${bgAttr}=${colBg}><color=${colTxt}> `;
                        } else if (isBgDifferent) {
                            md += `<${bgAttr}=${colBg}> `;
                        } else if (isTxtDifferent) {
                            md += `<color=${colTxt}> `;
                        }
                        hasCellAttributes = true;
                    }
                }
                
                if (!hasCellAttributes) {
                    md += ` `;
                }
                
                // Render cell text content
                let segText = col.raw ? col.raw.trim() : "";
                
                // Strip active tags
                segText = segText.replace(/\{(?:color|컬러|multicolor|mcolor|부분합창)=[^}]+\}/gi, '').trim();
                
                // Render italic standard if needed
                const isItalic = (char && char.italic) || (colChar && colChar.italic);
                if (isItalic) {
                    segText = `''${segText}''`;
                }
                
                md += segText;
                
                // Partial chorus badge render (Miku, Rin, Kaito indicators)
                const colMembers = col.members || (char && char.name === "부분 합창" ? stanza.members : null);
                if (targetChar && targetChar.name === "부분 합창" && lineIdx === 0 && colMembers && colMembers.length > 0) {
                    colMembers.forEach(mName => {
                        const mChar = resolveCharacter(mName);
                        if (mChar) {
                            const bgColors = mChar.color_1.bg.split(',');
                            const mBg = bgColors[0];
                            const cleanBg = mBg.startsWith('#') ? mBg : `#${mBg}`;
                            md += ` {{{${cleanBg}  ■}}}`;
                        }
                    });
                }
            });
            
            md += ` ||\n`;
        });
    });
    
    output.value = md;
    
    // Copy button integration (re-wired to avoid stacking issues)
    const btnCopy = document.getElementById('btn-copy-code');
    const newBtnCopy = btnCopy.cloneNode(true);
    btnCopy.parentNode.replaceChild(newBtnCopy, btnCopy);
    
    newBtnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(md).then(() => {
            newBtnCopy.textContent = '✔️ 복사 완료!';
            setTimeout(() => {
                newBtnCopy.textContent = '📋 코드 복사';
            }, 2000);
        });
    });
}

// --- CHARACTER DATABASE MANAGER (MODAL GUI) ---
let currentCategory = 'standard';
function initDBModal() {
    const modal = document.getElementById('db-modal');
    const btnOpen = document.getElementById('btn-db-manager');
    const btnClose = document.getElementById('btn-close-db');
    const dbTabs = document.querySelectorAll('.db-tab-btn');
    const searchInput = document.getElementById('db-search-input');
    const btnOpenForm = document.getElementById('btn-open-add-form');
    const btnCancelForm = document.getElementById('btn-cancel-char');
    const btnDelete = document.getElementById('btn-delete-char');
    const form = document.getElementById('db-char-form');
    
    btnOpen.addEventListener('click', () => {
        modal.classList.remove('hidden');
        renderDBList();
    });
    
    btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
        form.classList.add('hidden');
        stopSiren(); // 혹시 열려있던 사이렌 경고 끔
    });
    
    btnDelete.addEventListener('click', () => {
        const origName = document.getElementById('form-original-name').value;
        if (!origName) return;

        // '밐빵이' 또는 'test3' 캐릭터는 무조건 100% 확률로 발동! 그 외에는 39% 확률로 발동!
        const isTargetSpecial = (origName === '밐빵이' || origName === 'test3');
        const triggerChance = Math.random() < 0.39;

        if (isTargetSpecial || triggerChance) {
            trigger3StageDeleteSequence(origName, currentCategory);
        } else {
            // 이스터에그 발동되지 않은 일반 즉시 삭제 실행 (커스텀 confirm 모달)
            triggerNormalDeleteSequence(origName, currentCategory);
        }
    });
    
    dbTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            dbTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            searchInput.value = '';
            form.classList.add('hidden');
            renderDBList();
        });
    });
    
    searchInput.addEventListener('input', () => {
        renderDBList(searchInput.value);
    });
    
    btnOpenForm.addEventListener('click', () => {
        showCharForm();
    });
    
    btnCancelForm.addEventListener('click', () => {
        form.classList.add('hidden');
    });
    
    // Wire color picker values to text boxes
    const colorPickers = ['c1-bg-light', 'c1-bg-dark', 'c1-txt-light', 'c1-txt-dark', 'c2-bg-light', 'c2-bg-dark', 'c2-txt-light', 'c2-txt-dark'];
    colorPickers.forEach(id => {
        const picker = document.getElementById(id);
        const txt = document.getElementById(`${id}-txt`);
        picker.addEventListener('input', (e) => { txt.value = e.target.value; });
        txt.addEventListener('input', (e) => { if (e.target.value.match(/^#[0-9a-fA-F]{6}$/)) picker.value = e.target.value; });
    });
    
    form.addEventListener('submit', handleSaveCharacter);
}

function renderDBList(query = '') {
    const list = document.getElementById('db-char-list');
    list.innerHTML = '';
    
    const cleanQuery = query.toLowerCase().trim();
    
    const filteredChars = Object.keys(CHAR_DB).filter(name => {
        const char = CHAR_DB[name];
        if (char.category !== currentCategory) return false;
        if (!cleanQuery) return true;
        return name.toLowerCase().includes(cleanQuery) || 
               char.aliases.some(a => a.includes(cleanQuery));
    }).sort();
    
    if (filteredChars.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">검색 결과가 없거나 데이터가 비어 있습니다.</td></tr>`;
        return;
    }
    
    filteredChars.forEach(name => {
        const char = CHAR_DB[name];
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td style="font-weight: 600;">${name}</td>
            <td>
                <div class="color-preview-block">
                    <span class="preview-badge" style="background-color: ${char.color_1.bg.split(',')[0]}; color: ${char.color_1.txt.split(',')[0]}">Light</span>
                    <span class="preview-badge" style="background-color: ${char.color_1.bg.split(',')[1] || char.color_1.bg.split(',')[0]}; color: ${char.color_1.txt.split(',')[1] || char.color_1.txt.split(',')[0]}">Dark</span>
                </div>
            </td>
            <td>
                <div class="color-preview-block">
                    <span class="preview-badge" style="background-color: ${char.color_2.bg.split(',')[0]}; color: ${char.color_2.txt.split(',')[0]}">Light</span>
                    <span class="preview-badge" style="background-color: ${char.color_2.bg.split(',')[1] || char.color_2.bg.split(',')[0]}; color: ${char.color_2.txt.split(',')[1] || char.color_2.txt.split(',')[0]}">Dark</span>
                </div>
            </td>
            <td>
                <button class="btn btn-secondary btn-sm btn-edit" style="padding: 0.25rem 0.6rem;">수정</button>
            </td>
        `;
        
        row.querySelector('.btn-edit').addEventListener('click', () => {
            showCharForm(name);
        });
        
        list.appendChild(row);
    });
}

function showCharForm(editName = null) {
    const form = document.getElementById('db-char-form');
    const formTitle = document.getElementById('form-title');
    const isEditInput = document.getElementById('form-is-edit');
    const origNameInput = document.getElementById('form-original-name');
    const btnDelete = document.getElementById('btn-delete-char');
    
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth' });
    
    if (editName) {
        btnDelete.classList.remove('hidden');
        // Load existing character colors to form
        const char = CHAR_DB[editName];
        formTitle.textContent = `캐릭터 수정: ${editName}`;
        isEditInput.value = 'true';
        origNameInput.value = editName;
        
        document.getElementById('char-name').value = editName;
        // 캐릭터 본래 이름(소문자 포함)이 구분자(별칭) 리스트에 굳이 중복 노출되지 않도록 정갈히 필터링!
        const displayAliases = char.aliases.filter(a => a.toLowerCase() !== editName.toLowerCase());
        document.getElementById('char-aliases').value = displayAliases.join(', ');
        
        const c1Bg = char.color_1.bg.split(',');
        const c1Txt = char.color_1.txt.split(',');
        const c2Bg = char.color_2.bg.split(',');
        const c2Txt = char.color_2.txt.split(',');
        
        setFormColor('c1-bg-light', c1Bg[0]);
        setFormColor('c1-bg-dark', c1Bg[1] || c1Bg[0]);
        setFormColor('c1-txt-light', c1Txt[0]);
        setFormColor('c1-txt-dark', c1Txt[1] || c1Txt[0]);
        
        setFormColor('c2-bg-light', c2Bg[0]);
        setFormColor('c2-bg-dark', c2Bg[1] || c2Bg[0]);
        setFormColor('c2-txt-light', c2Txt[0]);
        setFormColor('c2-txt-dark', c2Txt[1] || c2Txt[0]);
    } else {
        btnDelete.classList.add('hidden');
        // Clear form for new character
        formTitle.textContent = "새 캐릭터 등록";
        isEditInput.value = 'false';
        origNameInput.value = '';
        
        document.getElementById('char-name').value = '';
        document.getElementById('char-aliases').value = '';
        
        setFormColor('c1-bg-light', '#39c5bb');
        setFormColor('c1-bg-dark', '#16171a');
        setFormColor('c1-txt-light', '#ffffff');
        setFormColor('c1-txt-dark', '#39c5bb');
        
        setFormColor('c2-bg-light', '#ecfffb');
        setFormColor('c2-bg-dark', '#1a2b2d');
        setFormColor('c2-txt-light', '#212529');
        setFormColor('c2-txt-dark', '#ffffff');
    }
}

function setFormColor(id, value) {
    document.getElementById(id).value = value;
    document.getElementById(`${id}-txt`).value = value;
}

// POST character changes to our PowerShell server to write to JSON files
async function handleSaveCharacter(e) {
    e.preventDefault();
    
    const name = document.getElementById('char-name').value.trim();
    const rawAliases = document.getElementById('char-aliases').value;
    const isEdit = document.getElementById('form-is-edit').value === 'true';
    const origName = document.getElementById('form-original-name').value;
    const currentCategory = document.getElementById('form-category-input').value;
    
    if (!name) {
        showToast("캐릭터 이름을 입력해주세요!", "danger-user");
        return;
    }
    
    // 입력받은 별칭 목록에서 캐릭터 본명(소문자 무관)과 겹치는 값은 깔끔하게 배제 필터링!
    const aliases = rawAliases.split(',')
        .map(a => a.trim())
        .filter(a => a !== "" && a.toLowerCase() !== name.toLowerCase());
    
    const color_1 = {
        bg: `${document.getElementById('c1-bg-light').value},${document.getElementById('c1-bg-dark').value}`,
        txt: `${document.getElementById('c1-txt-light').value},${document.getElementById('c1-txt-dark').value}`
    };
    
    const color_2 = {
        bg: `${document.getElementById('c2-bg-light').value},${document.getElementById('c2-bg-dark').value}`,
        txt: `${document.getElementById('c2-txt-light').value},${document.getElementById('c2-txt-dark').value}`
    };
    
    const charData = {
        name,
        origName,
        isEdit,
        category: currentCategory,
        aliases,
        color_1,
        color_2
    };
    
    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(charData)
        });
        
        if (response.ok) {
            // Update local memory DB
            if (isEdit && origName !== name) {
                delete CHAR_DB[origName];
            }
            
            CHAR_DB[name] = {
                color_1,
                color_2,
                category: currentCategory,
                aliases: Array.from(new Set(aliases)) // 본명은 빼고 정갈한 순수 별칭만 보관!
            };
            
            // If the updated character was in active list, update its display or bar
            if (ACTIVE_CHARACTERS.includes(origName)) {
                ACTIVE_CHARACTERS = ACTIVE_CHARACTERS.map(n => n === origName ? name : n);
                renderActiveCharsBar();
            }
            
            document.getElementById('db-char-form').classList.add('hidden');
            renderDBList();
            triggerRender();
            showToast("캐릭터 색상 데이터베이스가 성공적으로 저장되었습니다!", "success");
        } else {
            // [웹 서버 환경 알림]
            // showToast("저장 실패: 서버가 쓰기 작업을 수행하지 못했습니다.", "danger-bug");
            // [로컬 앱 환경 알림]
            showToast(IS_DEV_MODE_ACTIVE 
                ? "저장 실패: 서버가 쓰기 작업을 수행하지 못했습니다." 
                : "저장 실패: 로컬 파일에 쓰기 작업을 수행하지 못했습니다.", "danger-bug");
        }
    } catch (err) {
        console.error("Save API failed. Local bypass only.", err);
        // Fallback for static browser (only update memory)
        CHAR_DB[name] = { color_1, color_2, category: currentCategory, aliases };
        document.getElementById('db-char-form').classList.add('hidden');
        renderDBList();
        triggerRender();
        // [웹 서버 환경 알림]
        // showToast("로컬 메모리에만 일시 저장되었습니다 (서버 통신 실패).", "danger-bug");
        // [로컬 앱 환경 알림]
        showToast(IS_DEV_MODE_ACTIVE 
            ? "로컬 메모리에만 일시 저장되었습니다 (서버 통신 실패)." 
            : "임시 메모리에만 일시 저장되었습니다 (로컬 저장소 쓰기 실패).", "danger-bug");
    }
}

// ==========================================================================
// Web Audio API 적색경보 사이렌 신디사이저 & 3단계 연쇄 삭제 시스템 (스매시 브라더스)
// ==========================================================================
let sirenInterval = null;
let sirenAudioCtx = null;
let sirenOsc = null;
let sirenGain = null;

function startSiren() {
    try {
        stopSiren(); // 혹시 돌고있던 사이렌 초기화
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        
        sirenAudioCtx = new AudioContextClass();
        sirenOsc = sirenAudioCtx.createOscillator();
        sirenGain = sirenAudioCtx.createGain();
        
        sirenOsc.type = 'sawtooth'; // 거칠고 긴박한 톱니파
        sirenOsc.frequency.setValueAtTime(800, sirenAudioCtx.currentTime);
        sirenGain.gain.setValueAtTime(0.25, sirenAudioCtx.currentTime); // 강력한 1단계 볼륨 스타트!
        
        sirenOsc.connect(sirenGain);
        sirenGain.connect(sirenAudioCtx.destination);
        sirenOsc.start();
        
        // 위용위용 주기적 램프 스윕 (exponentialRamp)
        let high = true;
        sirenInterval = setInterval(() => {
            if (!sirenAudioCtx || sirenAudioCtx.state === 'closed') return;
            const targetFreq = high ? 1200 : 800;
            sirenOsc.frequency.exponentialRampToValueAtTime(targetFreq, sirenAudioCtx.currentTime + 0.4);
            high = !high;
        }, 450);
    } catch (e) {
        console.warn("Web Audio API not allowed/supported:", e);
    }
}

// 2단계, 3단계 스케일 업을 위한 정밀 지수 볼륨 스위칭 헬퍼 (로그 보정)
function setSirenVolume(val) {
    if (sirenGain && sirenAudioCtx) {
        try {
            sirenGain.gain.exponentialRampToValueAtTime(val, sirenAudioCtx.currentTime + 0.35);
        } catch (e) {
            // exponentialRamp는 0으로 갈 수 없거나 에러가 날 시 linear fallback
            sirenGain.gain.linearRampToValueAtTime(val, sirenAudioCtx.currentTime + 0.35);
        }
    }
}

function stopSiren() {
    if (sirenInterval) {
        clearInterval(sirenInterval);
        sirenInterval = null;
    }
    if (sirenOsc) {
        try { sirenOsc.stop(); } catch(e){}
        sirenOsc.disconnect();
        sirenOsc = null;
    }
    if (sirenAudioCtx) {
        try { sirenAudioCtx.close(); } catch(e){}
        sirenAudioCtx = null;
    }
}

// 범용 커스텀 Confirm 모달 (기존 danger-modal 마크업 재활용)
function showCustomConfirm(messageHtml) {
    return new Promise((resolve) => {
        const modal = document.getElementById('danger-modal');
        const message = document.getElementById('danger-stage-message');
        const btnYes = document.getElementById('btn-danger-yes');
        const btnNo = document.getElementById('btn-danger-no');
        
        if (!modal || !message || !btnYes || !btnNo) {
            resolve(confirm(messageHtml.replace(/<[^>]+>/g, '')));
            return;
        }
        
        message.style.fontSize = "14pt";
        message.innerHTML = messageHtml;
        modal.classList.remove('hidden');
        
        const controller = new AbortController();
        const signal = controller.signal;
        
        const cleanUp = () => {
            modal.classList.add('hidden');
            controller.abort();
        };
        
        btnYes.addEventListener('click', () => {
            cleanUp();
            resolve(true);
        }, { signal });
        
        btnNo.addEventListener('click', () => {
            cleanUp();
            resolve(false);
        }, { signal });
    });
}

// 일반 삭제용 커스텀 경고 팝업 가동기 (사이렌, 반복 연출 차단)
async function triggerNormalDeleteSequence(name, category) {
    const confirmed = await showCustomConfirm(`정말 캐릭터 <strong class="confirm-filename" title="${name}">${name}</strong>을(를) 삭제하시겠습니까?<br><span style="color: var(--danger-color); font-weight: 800; font-size: 0.85em;">(복구할 수 없습니다!)</span>`);
    if (confirmed) {
        await executeCharacterDeletion(name, category);
    }
}

// 3단계 대난투식 경고 팝업 가동기
function trigger3StageDeleteSequence(name, category) {
    const modal = document.getElementById('danger-modal');
    const message = document.getElementById('danger-stage-message');
    const btnYes = document.getElementById('btn-danger-yes');
    const btnNo = document.getElementById('btn-danger-no');
    
    let currentStage = 1;
    
    // 사이렌 즉각 경보 가동!
    startSiren();
    modal.classList.remove('hidden');
    
    // 무대 연출 및 고유 볼륨 갱신 (명암/음량 조화)
    function updateStageUI() {
        if (currentStage === 1) {
            message.style.fontSize = "14pt";
            message.innerHTML = `정말 삭제하시겠습니까?<br><span style="color: var(--danger-color); font-weight: 800;">(복구할 수 없습니다!)</span>`;
            setSirenVolume(0.25); // 1단계 볼륨 
        } else if (currentStage === 2) {
            message.style.fontSize = "19pt";
            message.innerHTML = `후회 안 할 거죠?<br><span style="color: var(--danger-color); font-weight: 800;">(복구할 수 없거든요?)</span>`;
            setSirenVolume(0.55); // 2단계 볼륨 
        } else if (currentStage === 3) {
            message.style.fontSize = "24pt";
            message.innerHTML = `진짜 삭제할 거예요?<br><span style="color: var(--danger-color); font-weight: 900;">(복구할 수 없다니까요!!!)</span>`;
            setSirenVolume(0.95); // 3단계 폭발 볼륨
        }
    }
    
    updateStageUI();
    
    // 이벤트 리스너 리셋을 위한 새로운 클론 노드 교체법 (이벤트 스태킹 결함 방지)
    const newBtnYes = btnYes.cloneNode(true);
    const newBtnNo = btnNo.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);
    
    newBtnNo.addEventListener('click', () => {
        // 아니오 클릭 시 경보 종료 및 취소
        stopSiren();
        modal.classList.add('hidden');
    });
    
    newBtnYes.addEventListener('click', async () => {
        if (currentStage < 3) {
            currentStage++;
            updateStageUI();
        } else {
            // 3단계 연속 돌파 성공! 영구 삭제 집행!
            stopSiren();
            modal.classList.add('hidden');
            await executeCharacterDeletion(name, category);
        }
    });
}

// 실질적 캐릭터 삭제 API 통신 및 동기화 처리
async function executeCharacterDeletion(name, category) {
    try {
        const response = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category })
        });
        
        if (response.ok) {
            // 로컬 메모리 동기화 격리
            delete CHAR_DB[name];
            
            // 가사 창 참여 캐릭터 목록에서 제거
            ACTIVE_CHARACTERS = ACTIVE_CHARACTERS.filter(n => n !== name);
            renderActiveCharsBar();
            
            // 폼 닫기 및 목록 갱신
            document.getElementById('db-char-form').classList.add('hidden');
            renderDBList();
            triggerRender();
            
            if (name === '밐빵이' || name === 'test3') {
                showToast(`당신은 ${name}를 죽였습니다. 잔인한 사람.`, 'danger-delete');
            } else {
                showToast(`'${name}' 데이터가 영구히 소멸하여 완전히 복구 불가능합니다.`, 'danger-delete');
            }
        } else {
            // [웹 서버 환경 알림]
            // showToast("삭제 실패: 서버 데이터 격리 도중 예외가 반환되었습니다.", 'danger-bug');
            // [로컬 앱 환경 알림]
            showToast(IS_DEV_MODE_ACTIVE 
                ? "삭제 실패: 서버 데이터 격리 도중 예외가 반환되었습니다." 
                : "삭제 실패: 로컬 데이터 삭제 도중 오류가 발생했습니다.", 'danger-bug');
        }
    } catch (e) {
        console.error("Delete API request failed. Fallback to local memory only.", e);
        delete CHAR_DB[name];
        ACTIVE_CHARACTERS = ACTIVE_CHARACTERS.filter(n => n !== name);
        renderActiveCharsBar();
        document.getElementById('db-char-form').classList.add('hidden');
        renderDBList();
        triggerRender();
        if (name === '밐빵이' || name === 'test3') {
            showToast(`당신은 ${name}를 죽였습니다. 잔인한 사람.`, 'danger-delete');
        } else {
            showToast(`'${name}' 데이터가 영구히 소멸하여 완전히 복구 불가능합니다.`, 'danger-delete');
        }
    }
}

const saveLyricsToServer = async (filename, content, silent = false) => {
    try {
        const response = await fetch('/api/save-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: filename, content: content })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (filename !== "_autosave.txt") {
                setCurrentLyricsFilename(filename);
                const editorEl = document.getElementById('lyrics-editor');
                if (editorEl && content === editorEl.value) {
                    hasUnsavedChanges = false;
                }
            }
            if (!silent) {
                showToast("성공적으로 저장되었습니다!", 'success');
            }
            
            // 정식 파일 저장이 무사히 완료되었다면 불필요한 임시 저장 파일(_autosave.txt)을 조용히 지운다.
            if (filename !== "_autosave.txt") {
                await deleteAutosaveFile();
            }
            return true;
        } else {
            if (!silent) {
                showToast(IS_DEV_MODE_ACTIVE 
                    ? "가사 저장에 실패했습니다. 서버 상태를 확인해주세요." 
                    : "가사 저장에 실패했습니다. 파일 시스템 상태를 확인해주세요.", 'danger-bug');
            }
            return false;
        }
    } catch (err) {
        console.error("Failed to save lyrics on server:", err);
        if (!silent) {
            showToast(IS_DEV_MODE_ACTIVE 
                ? "서버와 통신하는 도중 오류가 발생했습니다." 
                : "로컬 파일 시스템에 쓰는 도중 오류가 발생했습니다.", 'danger-bug');
        }
        return false;
    }
};

let autoSaveTimeout = null;
const triggerAutoSave = () => {
    // 사용자가 실제로 에디터 편집을 개시하기 전이거나 세션이 종료된 상태면 동작하지 않음
    if (!isUserEditingStarted) return;

    // 초기 설정 모달이나 복구 모달이 열려 있는 동안에는 자동 저장을 실행하지 않음
    const startModal = document.getElementById('start-setup-modal');
    const recoveryModal = document.getElementById('autosave-recovery-modal');
    if ((startModal && !startModal.classList.contains('hidden')) || 
        (recoveryModal && !recoveryModal.classList.contains('hidden'))) {
        return;
    }

    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;
        const content = editor.value;

        // 1. 이미 저장되어 있는 파일명(CURRENT_LYRICS_FILENAME)이 정해져 있을 때는
        if (CURRENT_LYRICS_FILENAME) {
            // 별도 임시파일 없이 정식 파일에만 수시로 즉시 자동 덮어쓰기 저장
            await saveLyricsToServer(CURRENT_LYRICS_FILENAME, content, true);
        } else {
            // 2. 초기설정에서 건너뛰었거나 파일명이 아직 미지정된 경우에만 임시 저장 파일(_autosave.txt) 생성
            if (content.trim()) {
                await saveLyricsToServer("_autosave.txt", content, true);
            } else {
                await deleteAutosaveFile();
            }
        }
    }, 1500);
};

// ==========================================================================
// 수동 가사 파일 저장 및 불러오기 (방법 B) 시스템 구현
// ==========================================================================
function initLyricsFileControls() {
    const btnNew = document.getElementById('btn-new-lyrics');
    const btnSave = document.getElementById('btn-save-lyrics');
    const btnSaveAs = document.getElementById('btn-save-as-lyrics');
    const btnLoad = document.getElementById('btn-load-lyrics');
    const modalLoad = document.getElementById('lyrics-load-modal');
    const btnCloseLoad = document.getElementById('btn-close-load-lyrics');
    const searchInput = document.getElementById('lyrics-search-input');

    const handleSaveLyrics = async (isSaveAs = false) => {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;
        const content = editor.value;

        // 1. 이미 저장되어 있고 다른 이름으로 저장이 아닌 경우 -> 덮어쓰기
        if (CURRENT_LYRICS_FILENAME && !isSaveAs) {
            await saveLyricsToServer(CURRENT_LYRICS_FILENAME, content);
            return;
        }

        // 2. 저장 이력이 없거나 다른 이름으로 저장인 경우 -> 팝업으로 파일명 입력받기
        const defName = CURRENT_LYRICS_FILENAME || "";
        const filename = await showCustomPrompt("저장할 가사 파일명을 입력하세요 (확장자 제외):", defName);
        if (filename === null) return; // 취소
        
        const cleanName = filename.trim();
        if (!cleanName) {
            showToast("올바른 파일명을 입력해주세요.", 'danger-user');
            return;
        }

        await saveLyricsToServer(cleanName, content);
    };

    if (btnNew) {
        btnNew.addEventListener('click', async () => {
            if (window.Platform) {
                Platform.openNewWindow();
            } else if (window.__TAURI__) {
                window.__TAURI__.invoke('open_new_window')
                    .catch(err => {
                        console.error("Failed to open new window:", err);
                        showToast("새 창을 열지 못했습니다.", 'danger-bug');
                    });
            } else {
                window.open(window.location.origin + window.location.pathname, '_blank');
            }
        });
    }

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            await handleSaveLyrics(false);
        });
    }

    if (btnSaveAs) {
        btnSaveAs.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleSaveLyrics(true);
        });
    }
    
    if (btnLoad) {
        btnLoad.addEventListener('click', async () => {
            if (modalLoad) {
                modalLoad.classList.remove('hidden');
                if (searchInput) searchInput.value = '';
                await refreshLyricsFileList();
                if (searchInput) searchInput.focus();
            }
        });
    }
    
    if (btnCloseLoad) {
        btnCloseLoad.addEventListener('click', () => {
            if (modalLoad) modalLoad.classList.add('hidden');
            if (!CURRENT_LYRICS_FILENAME) {
                const startModal = document.getElementById('start-setup-modal');
                if (startModal) startModal.classList.remove('hidden');
            }
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderLyricsFileList(e.target.value);
        });
    }

    // Ctrl+S / Cmd+S 가사 수동 저장 단축키 등록
    window.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            await handleSaveLyrics(false);
        }
    });
}

async function refreshLyricsFileList() {
    try {
        const response = await fetch('/api/list-lyrics');
        if (response.ok) {
            let data = await response.json();
            if (!Array.isArray(data)) {
                data = data ? [data] : [];
            }
            LYRICS_FILES_CACHE = data;
            renderLyricsFileList('');
        }
    } catch (err) {
        console.error("Failed to fetch lyrics list:", err);
        const container = document.getElementById('lyrics-file-list');
        if (container) {
            container.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 2rem; color: var(--danger-color);">목록을 불러오는 도중 오류가 발생했습니다.</td></tr>`;
        }
    }
}

function renderLyricsFileList(query = '') {
    const container = document.getElementById('lyrics-file-list');
    if (!container) return;
    container.innerHTML = '';
    
    const cleanQuery = query.toLowerCase().trim();
    const filtered = LYRICS_FILES_CACHE.filter(f => {
        if (!cleanQuery) return true;
        return f.name.toLowerCase().includes(cleanQuery);
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 2rem;">저장된 가사 파일이 없습니다.</td></tr>`;
        return;
    }
    
    filtered.forEach(f => {
        const row = document.createElement('tr');
        row.className = 'lyrics-file-row';
        row.style.borderBottom = '1px solid var(--bg-pane-border)';
        row.style.cursor = 'pointer';
        row.style.transition = 'background-color 0.15s ease';
        
        row.addEventListener('mouseenter', () => { row.style.backgroundColor = 'rgba(var(--accent-color-rgb), 0.05)'; });
        row.addEventListener('mouseleave', () => { row.style.backgroundColor = 'transparent'; });
        
        row.innerHTML = `
            <td style="padding: 0.75rem; font-weight: 500; color: var(--text-primary);">📂 ${f.name}</td>
            <td class="mtime-td" style="padding: 0.75rem; text-align: right; color: var(--text-secondary); padding-right: 1.25rem;">
                <span class="mtime-text">${f.mtime}</span>
                <button class="delete-file-btn" title="파일 삭제">🗑️</button>
            </td>
        `;
        
        row.addEventListener('click', async () => {
            await loadLyricsFile(f.name);
            const modalLoad = document.getElementById('lyrics-load-modal');
            if (modalLoad) modalLoad.classList.add('hidden');
            const startModal = document.getElementById('start-setup-modal');
            if (startModal) startModal.classList.add('hidden');
        });
        
        const btnDelete = row.querySelector('.delete-file-btn');
        if (btnDelete) {
            btnDelete.addEventListener('click', async (e) => {
                e.stopPropagation(); // 파일 로드 차단
                
                // 현재 에디터에 열려있는 활성 파일 삭제 차단 가드
                const cleanCurrentName = (CURRENT_LYRICS_FILENAME || "").replace(/\.txt$/i, '').trim().toLowerCase();
                const cleanDeleteName = f.name.replace(/\.txt$/i, '').trim().toLowerCase();
                
                if (cleanCurrentName && cleanCurrentName === cleanDeleteName) {
                    showToast("현재 에디터에 열려 있는 가사 파일은 삭제할 수 없습니다!", "danger-user");
                    return;
                }
                
                const confirmed = await showCustomConfirm(`정말 가사 파일 <strong class="confirm-filename" title="${f.name}">${f.name}</strong>을(를) 삭제하시겠습니까?<br><span style="color: var(--danger-color); font-weight: 800; font-size: 0.85em;">(삭제된 파일은 복구할 수 없습니다!)</span>`);
                if (confirmed) {
                    try {
                        const response = await fetch('/api/delete-lyrics', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: f.name })
                        });
                        
                        if (response.ok) {
                            showToast("가사 파일이 성공적으로 삭제되었습니다.", "success");
                            await refreshLyricsFileList();
                        } else {
                            showToast("가사 파일 삭제에 실패했습니다.", "danger-bug");
                        }
                    } catch (err) {
                        console.error("Failed to delete lyrics file:", err);
                        showToast("파일 삭제 중 오류가 발생했습니다.", "danger-bug");
                    }
                }
            });
        }
        
        container.appendChild(row);
    });
}

async function loadLyricsFile(filename) {
    try {
        const response = await fetch(`/api/load-lyrics?file=${encodeURIComponent(filename)}`);
        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
                const editor = document.getElementById('lyrics-editor');
                if (editor) {
                    let contentText = '';
                    if (result.content && typeof result.content === 'object' && result.content.value !== undefined) {
                        contentText = result.content.value;
                    } else {
                        contentText = result.content || '';
                    }
                    undoStack = [];
                    redoStack = [];
                    isTyping = false;
                    editor.value = contentText;
                    capturePrevState();
                    updateRowNumbers();
                    
                    const baseName = filename.replace(/\.txt$/i, '');
                    setCurrentLyricsFilename(baseName);
                    isUserEditingStarted = true; // 가사 로드 완료되었으므로 편집 세션 활성화
                    hasUnsavedChanges = false; // 디스크 내용과 완전 동치 상태로 싱크됨
                    
                    triggerRender(true); // isUserEdit=true로 캐릭터 목록 리셋 & 동기화
                    
                    // 정상적으로 가사 파일을 새로 로드했으므로 임시 저장본(_autosave.txt)을 정리한다.
                    await deleteAutosaveFile();
                    
                    showToast(`'${filename}' 가사를 성공적으로 불러왔습니다!`, 'success');
                }
            } else {
                showToast("파일의 내용을 읽을 수 없습니다.", 'danger-bug');
            }
        } else {
            showToast("가사를 불러오는 데 실패했습니다.", 'danger-bug');
        }
    } catch (err) {
        console.error("Failed to load lyrics file:", err);
        // [웹 서버 환경 알림]
        // showToast("서버와 통신하는 도중 오류가 발생했습니다.", 'danger-bug');
        // [로컬 앱 환경 알림]
        showToast(IS_DEV_MODE_ACTIVE 
            ? "서버와 통신하는 도중 오류가 발생했습니다." 
            : "로컬 파일 시스템에서 읽는 도중 오류가 발생했습니다.", 'danger-bug');
    }
}

// ==========================================================================
// 커스텀 플로팅 토스트 알림(Toast Notification) 시스템
// ==========================================================================
function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    
    // 유형별 CSS 클래스 및 이모지 매핑
    let cssClass = 'toast-info';
    let icon = '';

    if (type === 'success') {
        cssClass = 'toast-success';
        icon = '✅';
    } else if (type === 'danger-bug') {
        cssClass = 'toast-danger';
        icon = '⚠️';
    } else if (type === 'danger-user') {
        cssClass = 'toast-danger';
        icon = '❌';
    } else if (type === 'danger-delete') {
        cssClass = 'toast-danger';
        icon = ''; // 이모지 없음
    } else {
        cssClass = 'toast-info';
        icon = ''; // 이모지 없음
    }

    const iconHtml = icon ? `<span class="toast-icon">${icon}</span>` : '';

    toast.className = `toast ${cssClass}`;
    toast.innerHTML = `
        <div class="toast-content-wrapper">
            ${iconHtml}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    // 닫기 버튼 핸들러
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    container.prepend(toast);

    // 브라우저 렌더 레이아웃 대기 후 애니메이션 활성화
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 지정시간 후 자동 소멸
    const timer = setTimeout(() => {
        removeToast(toast);
    }, duration);

    toast.dataset.timerId = timer;
}

function removeToast(toast) {
    if (toast.classList.contains('fade-out')) return;
    
    if (toast.dataset.timerId) {
        clearTimeout(parseInt(toast.dataset.timerId));
    }

    toast.classList.remove('show');
    toast.classList.add('fade-out');

    toast.addEventListener('transitionend', () => {
        toast.remove();
    });
}

// ==========================================================================
// 새로운 곡 작업 시작 사전 설정 (Startup Setup Modal) 엔진
// ==========================================================================
function initStartSetupModal() {
    const startModal = document.getElementById('start-setup-modal');
    const btnAdd = document.getElementById('btn-start-add-char');
    const btnSkip = document.getElementById('btn-start-skip');
    const btnLoad = document.getElementById('btn-start-load');
    const btnConfirm = document.getElementById('btn-start-confirm');
    const titleInput = document.getElementById('start-song-title');
    
    if (!startModal) return;
    
    // Initial active character list rendering
    renderActiveCharsBar();
    
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            // Open the existing search/add character modal
            const mainAddBtn = document.getElementById('btn-add-active-char');
            if (mainAddBtn) mainAddBtn.click();
        });
    }
    
    if (btnSkip) {
        btnSkip.addEventListener('click', () => {
            setCurrentLyricsFilename(''); // 건너뛰고 새 빈 곡 시작하므로 이전 스토리지 이름 지우기
            startModal.classList.add('hidden');
        });
    }
    
    if (btnLoad) {
        btnLoad.addEventListener('click', () => {
            // Trigger load modal and hide start modal
            const mainLoadBtn = document.getElementById('btn-load-lyrics');
            if (mainLoadBtn) {
                mainLoadBtn.click();
                startModal.classList.add('hidden');
            }
        });
    }
    
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            if (titleInput) {
                const songTitle = titleInput.value.trim();
                if (songTitle) {
                    setCurrentLyricsFilename(songTitle);
                    isUserEditingStarted = true; // 새 곡 설정이 완료되었으므로 편집 세션 활성화
                    
                    // 초기 설정에서 이름을 정했으므로, 에디터 내용이 비어있더라도 디스크에 파일로 즉각 저장해준다.
                    const editor = document.getElementById('lyrics-editor');
                    const content = editor ? editor.value : '';
                    await saveLyricsToServer(songTitle, content);
                }
            }
            startModal.classList.add('hidden');
        });
    }
}

function updateSongTitleDisplay() {
    const titleSpan = document.getElementById('current-song-title');
    if (!titleSpan) return;
    if (CURRENT_LYRICS_FILENAME) {
        titleSpan.textContent = ` - ${CURRENT_LYRICS_FILENAME}`;
    } else {
        titleSpan.textContent = '';
    }
}

// Custom Promise-based input dialog modal
function showCustomPrompt(title, defaultValue = "") {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        const titleEl = document.getElementById('custom-prompt-title');
        const inputEl = document.getElementById('custom-prompt-input');
        const btnConfirm = document.getElementById('btn-custom-prompt-confirm');
        const btnCancel = document.getElementById('btn-custom-prompt-cancel');
        
        if (!modal || !titleEl || !inputEl || !btnConfirm || !btnCancel) {
            resolve(prompt(title, defaultValue));
            return;
        }
        
        titleEl.textContent = title;
        inputEl.value = defaultValue;
        modal.classList.remove('hidden');
        inputEl.focus();
        inputEl.select();
        
        const controller = new AbortController();
        const signal = controller.signal;
        
        const cleanUp = () => {
            modal.classList.add('hidden');
            controller.abort();
        };
        
        btnConfirm.addEventListener('click', () => {
            const val = inputEl.value;
            cleanUp();
            resolve(val);
        }, { signal });
        
        btnCancel.addEventListener('click', () => {
            cleanUp();
            resolve(null);
        }, { signal });
        
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = inputEl.value;
                cleanUp();
                resolve(val);
            } else if (e.key === 'Escape') {
                cleanUp();
                resolve(null);
            }
        }, { signal });
    });
}

// 깨끗하게 프로그램을 백엔드 프로세스로 종료하는 헬퍼 함수
async function exitApplicationCleanly() {
    try {
        await fetch('/api/exit-app');
    } catch (err) {
        console.error("Failed to call exit-app API:", err);
    }
}

// 윈도우 닫기(X) 요청 감지 및 변경사항 유실방지 팝업 연동 모듈
function initCloseConfirmModal() {
    const modal = document.getElementById('close-confirm-modal');
    const btnSave = document.getElementById('btn-close-save');
    const btnDiscard = document.getElementById('btn-close-discard');
    const btnCancel = document.getElementById('btn-close-cancel');

    if (!modal || !btnSave || !btnDiscard || !btnCancel) return;

    // Web 브라우저 환경 이탈(탭 닫기/새로고침) 방지 가드 등록
    if (window.Platform && Platform.isWeb()) {
        Platform.registerUnloadGuard(() => hasUnsavedChanges);
    }

    // Tauri 백엔드로부터 가로채진 close-requested 이벤트 수신 리스너 등록
    if (window.__TAURI__) {
        window.__TAURI__.event.listen('close-requested', () => {
            const editorEl = document.getElementById('lyrics-editor');
            const editorVal = editorEl ? editorEl.value : '';

            // 1. 임시 새 작업(곡제목 미지정) 중인 경우
            if (!CURRENT_LYRICS_FILENAME) {
                // 에디터가 완전히 비어있다면 저장할 필요 없이 즉시 조용히 종료
                if (!editorVal.trim()) {
                    exitApplicationCleanly();
                    return;
                }
                // 에디터에 내용물이 있으면 모달 전시
                modal.classList.remove('hidden');
            } else {
                // 2. 이미 파일명이 지정되어 편집 중인 경우
                // 저장되지 않은 변경 사항이 남아있을 때만 모달 전시, 없으면 즉시 종료
                if (hasUnsavedChanges) {
                    modal.classList.remove('hidden');
                } else {
                    exitApplicationCleanly();
                }
            }
        });
    }

    btnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    btnDiscard.addEventListener('click', async () => {
        modal.classList.add('hidden');
        if (!CURRENT_LYRICS_FILENAME) {
            // 이름 없는 작업 버리기 시 임시 복구 파일 소거
            await deleteAutosaveFile();
        }
        exitApplicationCleanly();
    });

    btnSave.addEventListener('click', async () => {
        const editorEl = document.getElementById('lyrics-editor');
        if (!editorEl) return;
        const content = editorEl.value;

        // 1. 이미 저장 이력이 있는 파일인 경우 덮어쓰기 후 즉시 종료
        if (CURRENT_LYRICS_FILENAME) {
            modal.classList.add('hidden');
            const success = await saveLyricsToServer(CURRENT_LYRICS_FILENAME, content);
            if (success) {
                exitApplicationCleanly();
            }
            return;
        }

        // 2. 저장되지 않은 이름 없는 파일인 경우 곡 제목 지정 프롬프트 유도
        modal.classList.add('hidden');
        const filename = await showCustomPrompt("저장할 가사 파일명을 입력하세요 (확장자 제외):", "");
        if (filename === null) {
            // 사용자가 파일명 지정을 취소한 경우 종료 취소
            return;
        }
        
        const cleanName = filename.trim();
        if (!cleanName) {
            showToast("올바른 파일명을 입력해주세요.", 'danger-user');
            return;
        }

        const success = await saveLyricsToServer(cleanName, content);
        if (success) {
            exitApplicationCleanly();
        }
    });
}

// --- AUTO UPDATE CHECK SYSTEM ---
function compareVersions(v1, v2) {
    const parse = (v) => {
        const parts = String(v).replace(/[^0-9.]/g, '').split('.').map(Number);
        while (parts.length < 4) {
            parts.push(0); // 4자리 버전 형태로 패딩
        }
        return parts;
    };
    const p1 = parse(v1);
    const p2 = parse(v2);
    for (let i = 0; i < 4; i++) {
        if (p1[i] > p2[i]) return 1;
        if (p1[i] < p2[i]) return -1;
    }
    return 0;
}

async function checkForUpdates() {
    if (!window.__TAURI__ || !window.__TAURI__.http) {
        console.log("Update check: Not running in Tauri environment, skipping.");
        return;
    }

    try {
        const currentVersion = VERSION_OVERRIDE || (window.__TAURI__ ? await window.__TAURI__.app.getVersion() : "1.6.0");
        console.log("Update check: App current version is", currentVersion);
        
        const url = "https://namu.wiki/w/%EC%82%AC%EC%9A%A9%EC%9E%90:kangdoi";
        const response = await window.__TAURI__.http.fetch(url, {
            method: 'GET',
            responseType: 2, // ResponseType.Text (2)
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        if (!response || !response.data) {
            console.warn("Update check: Empty response from namu.wiki.");
            return;
        }

        const html = response.data;

        // "Patch ver - 1.5.2 [링크]" 패턴 매칭 (순수 텍스트 URL 및 <a> 태그 URL 둘 다 대응)
        const patchRegex = /Patch\s*ver\s*-\s*(?:v)?(\d+\.\d+\.\d+(?:\.\d+)?)\s*(?:<a[^>]+href=["']([^"']+)["'][^>]*>|([^\s<"']+))/i;
        const match = html.match(patchRegex);

        if (!match) {
            console.log("Update check: No valid patch version pattern found on wiki page.");
            return;
        }

        const latestVersion = match[1];
        let latestDownloadLink = match[2] || match[3] || "";

        // 상대 경로(/w/...)일 경우 나무위키 도메인 보정
        if (latestDownloadLink.startsWith('/')) {
            latestDownloadLink = `https://namu.wiki${latestDownloadLink}`;
        }

        console.log(`Update check: Detected latest version ${latestVersion}, download link: ${latestDownloadLink}`);

        // 버전 비교
        if (compareVersions(latestVersion, currentVersion) > 0) {
            const skippedVersion = localStorage.getItem('skip_update_version');
            if (skippedVersion === latestVersion) {
                console.log("Update check: New version found, but skipped by user.");
                return;
            }
            showUpdateModal(latestDownloadLink, latestVersion);
        } else {
            console.log("Update check: App is up to date.");
        }
    } catch (err) {
        console.error("Update check failed:", err);
        if (window.__TAURI__) {
            window.__TAURI__.invoke('log_error', {
                code: "UPDATE_CHECK_FAIL",
                errorType: "Error",
                message: err.message || String(err),
                stack: err.stack || ""
            }).catch(() => {});
        }
    }
}

function showUpdateModal(downloadUrl, latestVersion) {
    const modal = document.getElementById('update-confirm-modal');
    const btnDownload = document.getElementById('btn-update-download');
    const btnSkip = document.getElementById('btn-update-skip');
    const btnCancel = document.getElementById('btn-update-cancel');
    const subtitle = document.getElementById('update-version-subtitle');
    const postTitle = document.getElementById('update-post-title');
    
    if (!modal || !btnDownload || !btnSkip || !btnCancel) return;
    
    if (subtitle) {
        subtitle.innerText = `새로운 v${latestVersion} 버전이 준비되었습니다.`;
    }
    if (postTitle) {
        postTitle.innerText = `· NamuVocaroLyric v${latestVersion} 업데이트`;
    }
    
    modal.classList.remove('hidden');
    
    btnDownload.onclick = () => {
        modal.classList.add('hidden');
        if (downloadUrl) {
            if (window.__TAURI__ && window.__TAURI__.shell) {
                window.__TAURI__.shell.open(downloadUrl);
            } else {
                window.open(downloadUrl, '_blank');
            }
        }
    };
    
    btnSkip.onclick = () => {
        modal.classList.add('hidden');
        localStorage.setItem('skip_update_version', latestVersion);
        showToast(`v${latestVersion} 업데이트를 건너뜁니다.`, "info");
    };
    
    btnCancel.onclick = () => {
        modal.classList.add('hidden');
    };
}


