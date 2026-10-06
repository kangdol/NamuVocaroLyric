# NamuVocaroLyric (나무보카로가사)

> **나무위키 보컬로이드 / Piapro Characters / 프로젝트 세카이 가사 마크다운 제작 에디터**  
> 현재 버전: **v1.5.1**(개발중) | 라이선스: **MIT**

---

## 📌 소개

**NamuVocaroLyric**은 음성합성엔진 오리지널 곡의 가사를 나무위키 가사 문법 규격(3단 가사: 일본어 원문, 발음, 한국어 번역) 및 캐릭터별 고유 컬러링에 맞춰 손쉽게 작성, 편집, 미리보기할 수 있도록 설계된 전문 가사 에디터입니다.

---

## ✨ 주요 기능

* **3단 가사 자동 구조화**: 일본어 원문, 발음, 한국어 번역을 체계적으로 작성 및 관리.
* **캐릭터 컬러링 지원**: 보컬로이드 및 세카이 캐릭터별 고유 hex 색상 자동 파싱 및 스타일 적용.
* **실시간 나무마크(NamuMark) 렌더링**: 위키에 붙여넣었을 때의 실제 표 모양을 실시간으로 확인.
* **가사 프로젝트 저장/불러오기**: `.txt`, `.json` 등 작업 문서 보관 및 백업.

---

## 💻 다운로드 및 설치

최신 버전의 독립 실행 파일 및 설치 프로그램은 GitHub Releases에서 다운로드하실 수 있습니다.

* **[⬇️ 최신 릴리즈 다운로드](https://github.com/kangdol/NamuVocaroLyric/releases)**

---
### 💻 웹 버전  
브라우저 상에서 바로 실행 할 수 있는 웹 버전 또한 준비되어 있습니다.

* **[웹 버전 링크](https://kangdol.github.io/NamuVocaroLyric/)**

---
## 🛠️ 기술 스택

* **Desktop Runtime**: [Tauri v1](https://tauri.app/) (Rust)
* **Frontend**: Vanilla JavaScript (ES6+), Modern HTML5 & CSS3
* **Markdown Parser**: Custom NamuMark Engine (`src/namumark.js`)

---

## 📄 라이선스 (License)

* **소프트웨어 소스 코드**: [MIT License](LICENSE)
* **캐릭터 색상 데이터 (`data/`)**: (https://namu.wiki/w/나무위키:프로젝트/음성 합성 엔진/컬러링) [CC BY-NC-SA 2.0 KR](https://creativecommons.org/licenses/by-nc-sa/2.0/kr/) 라이선스를 따릅니다.
