$workspace = "C:\Users\kangd\Documents\antigravity\wonderful-pasteur";
$files = @{
    standard = @{ path = "$workspace\developing\colors.txt"; out = "$workspace\data\colors.json" };
    sekai = @{ path = "$workspace\developing\colors_sekai.txt"; out = "$workspace\data\colors_sekai.json" };
    unit = @{ path = "$workspace\developing\colors_unit.txt"; out = "$workspace\data\colors_unit.json" };
};

function Clean-Name($nameCell) {
    if ($nameCell -match '\[\[(.*?)\]\]') {
        $content = $Matches[1];
        if ($content -like '*|*') {
            $parts = $content -split '\|';
            $name = $parts[-1];
        } else {
            $name = $content;
        }
        $name = $name.Replace('\', '');
        $name = $name -replace '\[\*.*?\]', '';
        return $name.Trim();
    }
    return $null;
}
function Clean-Color($colorCell) {
    if (-not $colorCell) { return ""; }
    $color = $colorCell.Trim();
    $color = $color -replace '\[\*.*?\]', '';
    if ($color -match '(#[0-9a-fA-F]{6}),(#[0-9a-fA-F]{6})') {
        return "$($Matches[1]),$($Matches[2])";
    }
    return $color.Trim();
}

foreach ($key in $files.Keys) {
    $fileInfo = $files[$key];
    $filepath = $fileInfo.path;
    $outputPath = $fileInfo.out;
    if (-not (Test-Path $filepath)) {
        Write-Host "Warning: File $filepath not found.";
        continue;
    }
    Write-Host "Parsing $key from $filepath...";
    $db = @{};
    $lines = Get-Content -Path $filepath -Encoding UTF8;
    $count = 0;
    foreach ($line in $lines) {
        $line = $line.Trim();
        if (-not $line.StartsWith("||") -or -not $line.EndsWith("||")) {
            continue;
        }
        $parts = $line -split '\|\|';
        if ($parts.Count -lt 14) {
            continue;
        }
        
        $c1_bg = Clean-Color $parts[4];
        if ($c1_bg -notmatch '^#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$') {
            continue;
        }
        
        $nameCell = $parts[1];
        $name = Clean-Name $nameCell;
        if (-not $name) {
            continue;
        }
        
        $c1_txt = Clean-Color $parts[7];
        $c2_bg = Clean-Color $parts[10];
        $c2_txt = Clean-Color $parts[13];
        
        $charData = @{
            color_1 = @{
                bg = $c1_bg;
                txt = $c1_txt;
            };
            color_2 = @{
                bg = $c2_bg;
                txt = $c2_txt;
            };
        };
        $db[$name] = $charData;
        $count++;
    }
    $json = $db | ConvertTo-Json -Depth 5;
    [System.IO.File]::WriteAllText($outputPath, $json, [System.Text.Encoding]::UTF8);
    Write-Host "Successfully compiled $count character color records to $outputPath!";
}
