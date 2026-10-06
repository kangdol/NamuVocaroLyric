@echo off
title NamuVocaroLyric Web Server
echo Starting NamuVocaroLyric Local Web Server...

set "PROJECT_DIR=C:\Users\kangd\Documents\antigravity\wonderful-pasteur"

if exist "%~dp0scripts\dev_web.js" (
    set "SERVER_SCRIPT=%~dp0scripts\dev_web.js"
) else if exist "%PROJECT_DIR%\scripts\dev_web.js" (
    set "SERVER_SCRIPT=%PROJECT_DIR%\scripts\dev_web.js"
) else (
    echo [ERROR] dev_web.js 파일을 찾을 수 없습니다: %SERVER_SCRIPT%
    pause
    exit /b 1
)

start http://localhost:8080/
node "%SERVER_SCRIPT%"
pause
