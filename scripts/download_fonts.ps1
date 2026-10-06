$fontsDir = "$PSScriptRoot\fonts"
if (!(Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Force -Path $fontsDir
}

$urls = @{
    "PretendardJP-Regular.woff2" = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard-jp/dist/web/static/woff2/PretendardJP-Regular.woff2";
    "PretendardJP-Bold.woff2" = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard-jp/dist/web/static/woff2/PretendardJP-Bold.woff2";
    
    "NotoSansCJKkr-Regular.woff2" = "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@latest/files/noto-sans-kr-korean-400-normal.woff2";
    "NotoSansCJKkr-Bold.woff2" = "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@latest/files/noto-sans-kr-korean-700-normal.woff2";
    
    "NotoSerifCJKkr-Regular.woff2" = "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-kr@latest/files/noto-serif-kr-korean-400-normal.woff2";
    "NotoSerifCJKkr-Bold.woff2" = "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-kr@latest/files/noto-serif-kr-korean-700-normal.woff2";
    
    "NanumGothic.woff2" = "https://cdn.jsdelivr.net/npm/@fontsource/nanum-gothic@latest/files/nanum-gothic-korean-400-normal.woff2";
    "NanumGothicBold.woff2" = "https://cdn.jsdelivr.net/npm/@fontsource/nanum-gothic@latest/files/nanum-gothic-korean-700-normal.woff2";
    
    "NanumBarunGothic.woff" = "https://cdn.jsdelivr.net/npm/@noonnu/nanumbarungothic@0.0.1/NanumBarunGothicWeb.woff";
    "NanumBarunGothicBold.woff" = "https://cdn.jsdelivr.net/npm/@noonnu/nanumbarungothic@0.0.1/NanumBarunGothicWeb.woff";
    
    "MaruBuri-Regular.woff2" = "https://hangeul.pstatic.net/hangeul_static/webfont/MaruBuri/MaruBuri-Regular.woff2";
    "MaruBuri-Bold.woff2" = "https://hangeul.pstatic.net/hangeul_static/webfont/MaruBuri/MaruBuri-Bold.woff2";
}

foreach ($fileName in $urls.Keys) {
    $targetPath = Join-Path $fontsDir $fileName
    $url = $urls[$fileName]
    
    if (Test-Path $targetPath) {
        $fileSize = (Get-Item $targetPath).Length
        if ($fileSize -lt 1024) {
            Remove-Item $targetPath -Force
        }
    }

    if (!(Test-Path $targetPath)) {
        Write-Host "Downloading $fileName..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $targetPath -UseBasicParsing -TimeoutSec 60
            Write-Host "$fileName downloaded successfully."
        } catch {
            Write-Host "ERROR: Failed to download $fileName from $url"
        }
    } else {
        Write-Host "$fileName already exists, skipping."
    }
}
Write-Host "All fonts downloaded successfully."
