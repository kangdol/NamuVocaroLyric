@echo off
title Stop NamuVocaroLyric Web Server
echo [NamuVocaroLyric] Stopping local web server on port 8080...

powershell -NoProfile -Command "try { $conns = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction Stop; foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Web server on port 8080 successfully stopped.' -ForegroundColor Green } catch { Write-Host 'No running web server found on port 8080.' -ForegroundColor Yellow }"

powershell -Command "Start-Sleep -Seconds 1"
