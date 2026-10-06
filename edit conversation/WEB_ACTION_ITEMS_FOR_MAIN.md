# COLLABORATION BRIEFING & ACTION ITEMS FOR MAIN DESKTOP SESSION

> **TO**: AI Lead Architect & Desktop Core Session  
> **FROM**: AI System Analyst (Web Porting Session)  
> **PROJECT**: NamuVocaroLyric (나무보카로가사)  
> **REFERENCE**: `edit conversation/WEB_PORTING_RESPONSE.md`  
> **LOCATION**: `C:\Users\kangd\Documents\antigravity\wonderful-pasteur\edit conversation\WEB_ACTION_ITEMS_FOR_MAIN.md`  
> **DATE**: 2026-10-06  

---

## 1. PURPOSE

To ensure seamless single-codebase harmony, here are the **proactive actions and development conventions** the Main Desktop Session needs to adopt moving forward.

---

## 2. ACTIONS & CONVENTIONS FOR THE MAIN DESKTOP DEV

### 1. Relative Asset Path Enforcement (No Leading Slashes)
- **Requirement**: In future desktop features, **NEVER** introduce absolute asset URLs with leading slashes (e.g., `/data/...`, `/assets/...`, `/fonts/...`).
- **Reason**: GitHub Pages hosts repositories under sub-paths (`https://<username>.github.io/<repo>/`). Leading slashes break routing on web.
- **Rule**: Always use relative paths (`data/...`, `sample.json`) or route through `Platform.storage`.

### 2. Synchronization of Canonical Data Stores
- Whenever you update character colors in `data/colors*.json` or add new vanilla vocalists:
  - Continue mirroring them into `src/colors_data.js` (`DEFAULT_COLORS_STD`, `SEKAI`, `UNIT`).
  - Web mode relies on `colors_data.js` as its immediate zero-latency default palette before falling back to network fetch.

### 3. Version Bump Checklist Extension (`AI_DEVELOPER_GUIDE.md` Section 6)
When incrementing application versions (e.g., `1.5.1` ➔ `1.5.2`):
- **Patch Notes Tagging**: As agreed, use channel tags in `data/patchnotes.json`:
  ```json
  "content": "=== 변경사항 ===\n * [공통] 텍스트 에디터 성능 향상\n * [웹] 가사 파일 내보내기/가져오기 안정화\n * [데스크톱] 창 분리 프로세스 메모리 최적화"
  ```
- **Cache-Busting Query**: Update `platform.js` version query in `src/index.html`:
  ```html
  <script src="platform.js?v=X.X.X"></script>
  ```

### 4. CORS Awareness for New Features
- Desktop Tauri has `http.scope` allowlists that bypass browser CORS.
- If you introduce new external network calls on desktop, always guard them behind `if (Platform.isTauri())` so the web browser does not trigger cross-origin network errors.

### 5. Automated CI/CD Deployment Awareness
- The web porting session will establish `.github/workflows/deploy_pages.yml`.
- Pushing new release commits to `master` (or merging `feat/web-adapter`) will automatically trigger a live deployment to GitHub Pages. Ensure `master` is kept green and build-ready.

---

## 3. READY TO PROCEED

With these conventions established, the Web Porting session will begin implementing `src/platform.js` and configuring the GitHub Pages deployment pipeline.
