[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactsJson,

    [Parameter(Mandatory = $true)]
    [string]$MediaRoot,

    [string]$OutputPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 這支檢查只做本地批次讀取，不呼叫故宮服務，也不修改資料庫或圖片檔。
# 目的 是用最低成本先篩出破圖、低解析圖與常見的「無圖片」佔位圖，再人工檢查少量結果。
Add-Type -AssemblyName System.Drawing

$ArtifactsJson = [IO.Path]::GetFullPath($ArtifactsJson)
$MediaRoot = [IO.Path]::GetFullPath($MediaRoot)
if (-not (Test-Path -LiteralPath $ArtifactsJson -PathType Leaf)) {
    throw "找不到文物 JSON：$ArtifactsJson"
}
if (-not (Test-Path -LiteralPath $MediaRoot -PathType Container)) {
    throw "找不到媒體根目錄：$MediaRoot"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path (Split-Path -Parent $ArtifactsJson) "media-quality-report.json"
} else {
    $OutputPath = [IO.Path]::GetFullPath($OutputPath)
}

function Resolve-MediaPath([object]$Row, [string]$Kind) {
    $property = if ($Kind -eq "display") { "imageUrl" } else { "thumbnailUrl" }
    $relative = [string]$Row.$property
    $direct = Join-Path $MediaRoot ($relative -replace '/', '\')
    if (Test-Path -LiteralPath $direct -PathType Leaf) {
        return $direct
    }

    # 匯入包使用 artifacts/<category>/<bucket>/<ref>；網站執行期則使用
    # /media/catalog/<category>/<ref>，這裡支援兩種路徑，避免 QA 工具限制部署方式。
    $category = ([string]$Row.categoryCode).ToLowerInvariant()
    $artifactRef = [string]$Row.artifactRef
    $fileName = if ($Kind -eq "display") { "display.jpg" } else { "thumbnail.jpg" }
    $catalogPath = Join-Path $MediaRoot (Join-Path "catalog\$category\$artifactRef" $fileName)
    if (Test-Path -LiteralPath $catalogPath -PathType Leaf) {
        return $catalogPath
    }

    return $direct
}

function Read-ImageStats([string]$Path) {
    $stream = $null
    $image = $null
    $sample = $null
    $graphics = $null
    try {
        $stream = [IO.File]::OpenRead($Path)
        $image = [Drawing.Image]::FromStream($stream, $true, $true)
        $sample = [Drawing.Bitmap]::new(24, 24)
        $graphics = [Drawing.Graphics]::FromImage($sample)
        $graphics.DrawImage($image, 0, 0, 24, 24)

        [double]$sum = 0
        [double]$sumSquares = 0
        [double]$minimum = 255
        [double]$maximum = 0
        for ($y = 0; $y -lt 24; $y++) {
            for ($x = 0; $x -lt 24; $x++) {
                $pixel = $sample.GetPixel($x, $y)
                $luma = 0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B
                $sum += $luma
                $sumSquares += $luma * $luma
                $minimum = [Math]::Min($minimum, $luma)
                $maximum = [Math]::Max($maximum, $luma)
            }
        }

        $count = 24 * 24
        $mean = $sum / $count
        $variance = ($sumSquares / $count) - ($mean * $mean)
        return [pscustomobject]@{
            Width = $image.Width
            Height = $image.Height
            Bytes = (Get-Item -LiteralPath $Path).Length
            MeanLuma = [Math]::Round($mean, 2)
            LumaVariance = [Math]::Round([Math]::Max(0, $variance), 2)
            LumaRange = [Math]::Round($maximum - $minimum, 2)
            Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
        }
    } finally {
        if ($graphics) { $graphics.Dispose() }
        if ($sample) { $sample.Dispose() }
        if ($image) { $image.Dispose() }
        if ($stream) { $stream.Dispose() }
    }
}

$rows = @(Get-Content -Raw -LiteralPath $ArtifactsJson | ConvertFrom-Json)
$issues = [Collections.Generic.List[object]]::new()
$checkedFiles = [Collections.Generic.List[object]]::new()

foreach ($row in $rows) {
    foreach ($kind in @("display", "thumbnail")) {
        $path = Resolve-MediaPath $row $kind
        $relativePath = $path.Substring($MediaRoot.Length).TrimStart('\', '/')
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            $issues.Add([pscustomobject]@{
                ArtifactRef = [string]$row.artifactRef
                Kind = $kind
                Code = "MISSING"
                Path = $relativePath
                Detail = "資料列有引用，但媒體檔不存在。"
            })
            continue
        }

        try {
            $stats = Read-ImageStats $path
            $checkedFiles.Add([pscustomobject]@{
                ArtifactRef = [string]$row.artifactRef
                Kind = $kind
                Path = $relativePath
                Width = $stats.Width
                Height = $stats.Height
                Bytes = $stats.Bytes
                MeanLuma = $stats.MeanLuma
                LumaVariance = $stats.LumaVariance
                Sha256 = $stats.Sha256
            })

            # thumbnail 本來就會縮到小尺寸；只有 display 主圖需要檢查展示最低解析度。
            if ($kind -eq "display" -and [Math]::Max($stats.Width, $stats.Height) -lt 200) {
                $issues.Add([pscustomobject]@{
                    ArtifactRef = [string]$row.artifactRef
                    Kind = $kind
                    Code = "LOW_DIMENSION"
                    Path = $relativePath
                    Detail = "圖片任一邊小於 200px，可能是錯誤縮圖或不適合展示。"
                })
            }

            # 目前常見的故宮「無圖片」佔位圖是近白且低變異；只列為疑似，避免誤刪合法留白文物圖。
            # 佔位圖的文字與紅色印記會讓 range 偶爾略超過原門檻；保留低變異＋近白雙條件，
            # 比死記某一版 NPM 佔位圖的像素範圍更能抓到同類回應。
            if ($kind -eq "display" -and $stats.MeanLuma -ge 225 -and $stats.LumaVariance -le 600) {
                $issues.Add([pscustomobject]@{
                    ArtifactRef = [string]$row.artifactRef
                    Kind = $kind
                    Code = "PLACEHOLDER_LIKE"
                    Path = $relativePath
                    Detail = "近白且低變異，疑似『無圖片』佔位圖；需人工確認後再替換。"
                })
            }
        } catch {
            $issues.Add([pscustomobject]@{
                ArtifactRef = [string]$row.artifactRef
                Kind = $kind
                Code = "DECODE_FAILED"
                Path = $relativePath
                Detail = $_.Exception.Message
            })
        }
    }
}

$duplicateGroups = @(
    $checkedFiles |
        Where-Object { $_.Kind -eq "display" } |
        Group-Object Sha256 |
        Where-Object { $_.Count -gt 1 } |
        ForEach-Object {
            [pscustomobject]@{
                Sha256 = $_.Name
                Count = $_.Count
                ArtifactRefs = @($_.Group | Select-Object -ExpandProperty ArtifactRef)
            }
        }
)

$report = [pscustomobject]@{
    GeneratedAtUtc = [DateTime]::UtcNow.ToString("O")
    ArtifactCount = $rows.Count
    ExpectedFileCount = $rows.Count * 2
    CheckedFileCount = $checkedFiles.Count
    IssueCount = $issues.Count
    MissingCount = @($issues | Where-Object Code -eq "MISSING").Count
    DecodeFailedCount = @($issues | Where-Object Code -eq "DECODE_FAILED").Count
    PlaceholderLikeCount = @($issues | Where-Object Code -eq "PLACEHOLDER_LIKE").Count
    LowDimensionCount = @($issues | Where-Object Code -eq "LOW_DIMENSION").Count
    DuplicateDisplayHashGroups = $duplicateGroups
    Issues = @($issues)
    Files = @($checkedFiles)
}

$parent = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $parent | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8NoBOM

Write-Output ("MEDIA_QA|artifacts:{0}|files:{1}|issues:{2}|missing:{3}|decode:{4}|placeholder-like:{5}|low-dimension:{6}|duplicate-groups:{7}" -f `
    $report.ArtifactCount,
    $report.CheckedFileCount,
    $report.IssueCount,
    $report.MissingCount,
    $report.DecodeFailedCount,
    $report.PlaceholderLikeCount,
    $report.LowDimensionCount,
    $report.DuplicateDisplayHashGroups.Count)
Write-Output "REPORT|$OutputPath"
