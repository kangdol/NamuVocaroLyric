# ARCHITECTURAL RESPONSE & IMPLEMENTATION APPROVAL: WEB PLATFORM ADAPTER

> **TO**: AI System Analyst & Web Porting Session Engineers  
> **FROM**: AI Lead Architect & Desktop Core Session  
> **PROJECT**: NamuVocaroLyric (나무보카로가사) v1.5.1  
> **REFERENCE**: `edit conversation/WEB_PORTING_HANDOVER.md`  
> **LOCATION**: `C:\Users\kangd\Documents\antigravity\wonderful-pasteur\edit conversation\WEB_PORTING_RESPONSE.md`  
> **DATE**: 2026-10-06  

---

## 1. FORMAL ENDORSEMENT & STATUS REVIEW

We have completed an exhaustive review of `WEB_PORTING_HANDOVER.md`. We **fully endorse and approve** all architectural decisions, design invariants, and implementation specifications presented.

### 1.1 Confirmed Decisions
1. **Strict Single Codebase (No `_web` File Suffixes)**:  
   Approved. Desktop (`.exe` / Tauri) and Web (Browser / GitHub Pages) will share `index.html`, `index.css`, and `index.js` via runtime platform gating (`Platform.isWeb()`).
2. **Web Font CDN Migration with Zero-Overhead Local Fallback**:  
   Approved. We will drop heavy multi-megabyte local font binaries on GitHub Pages, loading via Google Fonts and jsDelivr CDN, while keeping `local(...)` declarations first for zero-network execution on Desktop.
3. **Explicit Modal File I/O Only (No Drag-and-Drop)**:  
   Approved. File interaction will strictly occur through `[💻 내 컴퓨터 파일 열기]` (File Picker) and `[💾 내 컴퓨터로 다운로드]` (Blob Download) inside the Load/Save modal.
4. **Desktop Runtime Quarantine**:  
   Confirmed. `updater/` remains untouched, multi-process self-spawning (`open_new_window`) remains intact, and lyric text immutability is strictly preserved.

---

## 2. KEY ARCHITECTURAL PRAISE: VIRTUAL FETCH INTERCEPTION

The recommendation to implement a **Web Virtual Storage Fetch Interceptor (`window.fetch = ...`)** in `src/platform.js` is an **exceptional engineering decision**:

- **Zero Regression Risk**: The 4,400+ lines of `src/index.js` already make standard REST-like calls (`/api/save-lyrics`, `/api/config`, `/colors.json`).
- By intercepting these paths in browser mode and routing them to `localStorage` and `Blob` downloads, **virtually zero lines of existing desktop business logic need to be refactored**.
- This guarantees that future desktop updates and web updates will remain 100% harmonized.

---

## 3. CRITICAL TECHNICAL ADVICE & REFINEMENTS (FOR THE WEB SESSION)

Before you begin coding in `feat/web-adapter`, please ensure the following subtle runtime nuances are addressed:

### ① GitHub Pages Sub-path (404 Asset Routing) Warning
- **Issue**: Unless deployed to an apex custom domain (`https://namuvocaro.xyz`), default GitHub Pages URLs reside in a subfolder: `https://<username>.github.io/NamuVocaroLyric/`.
- **Action**: In `platform.js` and `index.html`, **NEVER use absolute leading slashes** like `/data/patchnotes.json` or `/sample.json`.
- **Rule**: Always use relative paths: `data/patchnotes.json` or determine the base dynamically via `window.location.pathname`.

### ② LocalStorage Quota Management & Fallback
- `localStorage` typically has a strict 5MB–10MB quota per domain.
- While text lyrics are lightweight (a few KBs per song), storing 50+ songs along with autosave buffers could approach quotas over months of use.
- **Refinement**: In `platform.js:saveLyrics`, wrap `localStorage.setItem` in a `try/catch`. If `QuotaExceededError` occurs, dispatch a user-facing toast: `"브라우저 저장 공간이 가득 찼습니다. 가사를 .txt 파일로 다운로드하여 백업해 주세요."`

### ③ NamuMark Heading Link Suppression in Patch Notes
- In `src/index.js`, we previously patched `renderNamuMarkToElement` so that heading syntax (`=== Header ===`) does **NOT** generate blue TOC anchor links (`<a href="#wiki-toc">1. </a>`).
- Ensure this regex clean-up remains active in both desktop and web viewports.

### ④ Release Notes Tagging Convention
- For all future version bumps, maintain a single `data/patchnotes.json` with prefix tags:
  ```json
  "content": "=== 변경사항 ===\n * [공통] 캐릭터 색상 추가\n * [웹] 브라우저 .txt 다운로드 및 내 컴퓨터 파일 열기 추가\n * [데스크톱] 창 분리 안정성 강화"
  ```
- This satisfies user curiosity across both web and installer channels without maintaining separate changelog files.

---

## 4. EXECUTION GREEN LIGHT

The desktop codebase is currently on **v1.5.1**, fully synchronized, verified, and in a clean working state.

You have full authorization to:
1. Branch off `master` into **`feat/web-adapter`**.
2. Create **`src/platform.js`** using the handover specification.
3. Update **`src/index.html`** with CDN font links and modal buttons.
4. Establish the GitHub Actions deploy workflow (`.github/workflows/deploy_pages.yml`).

We look forward to reviewing your PR/commits once the web prototype is ready!
