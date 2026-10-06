$ErrorActionPreference = "Stop"

$installer = Get-ChildItem -Path . -Filter "namuvocarolyric_1.5.1_installer.exe" -Recurse | Select-Object -First 1
if (-not $installer) {
    throw "namuvocarolyric_1.5.1_installer.exe not found!"
}
$installerPath = $installer.FullName
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

# 2. Check if release v1.5.1 already exists
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/kangdol/NamuVocaroLyric/releases/tags/v1.5.1" -Headers $headers -Method Get
    Write-Host "Found existing release v1.5.1 (ID: $($release.id))"
} catch {
    Write-Host "Release v1.5.1 does not exist yet. Creating..."
}

if (-not $release) {
    $bodyObj = @{
        tag_name = "v1.5.1"
        target_commitish = "master"
        name = "v1.5.1 Release"
        body = "## NamuVocaroLyric v1.5.1`n`n### Changes`n* Update check page updated`n`n---`n### Windows Installer`n* Download `namuvocarolyric_1.5.1_installer.exe` below and run to install."
        draft = $false
        prerelease = $false
    }
    $bodyJson = $bodyObj | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/kangdol/NamuVocaroLyric/releases" -Headers $headers -Method Post -Body $bytes -ContentType "application/json; charset=utf-8"
    Write-Host "Created release v1.5.1 (ID: $($release.id))"
}

# 3. Check if asset is already attached
$assetName = "namuvocarolyric_1.5.1_installer.exe"
$existingAsset = $release.assets | Where-Object { $_.name -eq $assetName }
if ($existingAsset) {
    Write-Host "Asset $assetName already exists (ID: $($existingAsset.id)). Deleting old asset to re-upload..."
    Invoke-RestMethod -Uri "https://api.github.com/repos/kangdol/NamuVocaroLyric/releases/assets/$($existingAsset.id)" -Headers $headers -Method Delete
    Write-Host "Old asset deleted."
}

# 4. Upload binary asset
$uploadUri = ($release.upload_url -replace '\{\?name,label\}', "") + "?name=$assetName"
Write-Host "Uploading installer ($([math]::Round($installer.Length / 1MB, 2)) MB) to GitHub Releases..."

$uploadHeaders = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/octet-stream"
    "User-Agent" = "NamuVocaroLyric-Deploy"
}

$uploaded = Invoke-RestMethod -Uri $uploadUri -Headers $uploadHeaders -Method Post -InFile $installerPath
Write-Host "Upload completed successfully!"
Write-Host "Release Page: $($release.html_url)"
Write-Host "Direct Download URL: $($uploaded.browser_download_url)"
