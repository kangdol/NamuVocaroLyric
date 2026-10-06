$ErrorActionPreference = "Stop"

$installerPath = "src-tauri\target\release\bundle\nsis\NamuVocaroLyric_1.6.0_x64-setup.exe"
if (-not (Test-Path $installerPath)) {
    $installer = Get-ChildItem -Path . -Filter "namuvocarolyric_1.6.0_installer.exe" -Recurse | Select-Object -First 1
    if (-not $installer) {
        throw "v1.6.0 installer executable not found!"
    }
    $installerPath = $installer.FullName
} else {
    $installerPath = (Resolve-Path $installerPath).Path
}

Write-Host "Found installer at: $installerPath"

# 1. Get credentials from git credential helper
$credOutput = ("protocol=https`nhost=github.com" | git credential fill | Out-String)
$token = ($credOutput -split "`n" | Where-Object { $_ -match "^password=" }) -replace "^password=", ""
$token = $token.Trim()
if (-not $token) {
    throw "Could not retrieve GitHub token."
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "NamuVocaroLyric-Deploy"
}

# 2. Check if release v1.6.0 already exists
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/kangdol/NamuVocaroLyric/releases/tags/v1.6.0" -Headers $headers -Method Get
    Write-Host "Found existing release v1.6.0 (ID: $($release.id))"
} catch {
    Write-Host "Release v1.6.0 does not exist yet. Creating..."
}

if (-not $release) {
    $releaseBody = @"
## NamuVocaroLyric v1.6.0

### 🌟 주요 추가기능
* **[웹] 브라우저 웹 서비스 대응**: GitHub Pages 배포 지원 (https://kangdol.github.io/NamuVocaroLyric/)
* **[웹] 데스크톱 다운로드 링크**: 메인 화면 좌측 하단 플로팅 버튼 추가
* **[공통] 설정 및 캐릭터 DB 초기화**: 설정창 우하단 데이터 초기화(Factory Reset) 기능 추가

### 🛠️ 변경사항
* **[데스크톱] 업데이트 확인**: GitHub Releases 최신 버전 자동 조회 및 원클릭 다운로드 연동

---
### ⬇️ Windows 설치 파일
* 아래 첨부된 `namuvocarolyric_1.6.0_installer.exe`를 다운로드하여 실행하시면 설치 및 업데이트가 완료됩니다.
"@

    $bodyObj = @{
        tag_name = "v1.6.0"
        target_commitish = "master"
        name = "v1.6.0 Release"
        body = $releaseBody
        draft = $false
        prerelease = $false
    }
    $bodyJson = $bodyObj | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/kangdol/NamuVocaroLyric/releases" -Headers $headers -Method Post -Body $bytes -ContentType "application/json; charset=utf-8"
    Write-Host "Created release v1.6.0 (ID: $($release.id))"
}

# 3. Check if asset is already attached
$assetName = "namuvocarolyric_1.6.0_installer.exe"
$existingAsset = $release.assets | Where-Object { $_.name -eq $assetName }
if ($existingAsset) {
    Write-Host "Asset $assetName already exists (ID: $($existingAsset.id)). Deleting old asset to re-upload..."
    Invoke-RestMethod -Uri "https://api.github.com/repos/kangdol/NamuVocaroLyric/releases/assets/$($existingAsset.id)" -Headers $headers -Method Delete
    Write-Host "Old asset deleted."
}

# 4. Upload binary asset
$uploadUri = ($release.upload_url -replace '\{\?name,label\}', "") + "?name=$assetName"
$fileItem = Get-Item $installerPath
Write-Host "Uploading installer ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to GitHub Releases..."

$uploadHeaders = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/octet-stream"
    "User-Agent" = "NamuVocaroLyric-Deploy"
}

$uploaded = Invoke-RestMethod -Uri $uploadUri -Headers $uploadHeaders -Method Post -InFile $installerPath
Write-Host "Upload completed successfully!"
Write-Host "Release Page: $($release.html_url)"
Write-Host "Direct Download URL: $($uploaded.browser_download_url)"
