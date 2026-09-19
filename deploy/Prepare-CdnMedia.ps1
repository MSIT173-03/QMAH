[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactsJson,

    [Parameter(Mandatory = $true)]
    [string]$MediaRoot,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 資料庫只保存 /media/... 邏輯路徑；本腳本把匯入包的 artifacts/ 路徑
# 整理成網站與 CDN 共用的 catalog/ 路徑，未來換 Vercel、Cloudflare R2 或 S3
# 時不需要改資料庫內容，也不會把本機路徑寫進前端。
$ArtifactsJson = [IO.Path]::GetFullPath($ArtifactsJson)
$MediaRoot = [IO.Path]::GetFullPath($MediaRoot)
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)

if (-not (Test-Path -LiteralPath $ArtifactsJson -PathType Leaf)) {
    throw "找不到文物匯入 JSON：$ArtifactsJson"
}
if (-not (Test-Path -LiteralPath $MediaRoot -PathType Container)) {
    throw "找不到媒體根目錄：$MediaRoot"
}
if (Test-Path -LiteralPath $OutputDirectory) {
    $existing = @(Get-ChildItem -LiteralPath $OutputDirectory -Force)
    if ($existing.Count -gt 0) {
        throw "輸出目錄不是空的，為避免 CDN 素材混版而停止：$OutputDirectory"
    }
} else {
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
}

function Resolve-SourcePath([object]$Row, [string]$Kind) {
    $property = if ($Kind -eq "display") { "imageUrl" } else { "thumbnailUrl" }
    $relative = [string]$Row.$property
    $direct = Join-Path $MediaRoot ($relative -replace '/', '\')
    if (Test-Path -LiteralPath $direct -PathType Leaf) {
        return $direct
    }

    $category = ([string]$Row.categoryCode).ToLowerInvariant()
    $artifactRef = [string]$Row.artifactRef
    $fileName = if ($Kind -eq "display") { "display.jpg" } else { "thumbnail.jpg" }
    $catalogPath = Join-Path $MediaRoot (Join-Path "catalog\$category\$artifactRef" $fileName)
    if (Test-Path -LiteralPath $catalogPath -PathType Leaf) {
        return $catalogPath
    }

    throw "找不到 $Kind 媒體：$($Row.artifactRef)；嘗試過 $direct 與 $catalogPath"
}

$rows = @(Get-Content -Raw -LiteralPath $ArtifactsJson | ConvertFrom-Json)
if ($rows.Count -eq 0) {
    throw "文物匯入 JSON 沒有資料。"
}

$manifestFiles = [Collections.Generic.List[object]]::new()
foreach ($row in $rows) {
    $category = ([string]$row.categoryCode).ToLowerInvariant()
    $artifactRef = [string]$row.artifactRef
    $relativeDirectory = "catalog\$category\$artifactRef"
    $destinationDirectory = Join-Path $OutputDirectory $relativeDirectory
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null

    foreach ($kind in @("display", "thumbnail")) {
        $source = Resolve-SourcePath $row $kind
        $fileName = if ($kind -eq "display") { "display.jpg" } else { "thumbnail.jpg" }
        $destination = Join-Path $destinationDirectory $fileName
        Copy-Item -LiteralPath $source -Destination $destination -Force
        $relativeOutput = (Join-Path $relativeDirectory $fileName) -replace '\\', '/'
        $manifestFiles.Add([pscustomobject]@{
            logicalPath = "/media/$relativeOutput"
            relativePath = $relativeOutput
            artifactRef = $artifactRef
            kind = $kind
            bytes = (Get-Item -LiteralPath $destination).Length
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash
        })
    }
}

$manifest = [pscustomobject]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString("O")
    sourceArtifactsJson = [IO.Path]::GetFileName($ArtifactsJson)
    artifactCount = $rows.Count
    fileCount = $manifestFiles.Count
    totalBytes = ($manifestFiles | Measure-Object -Property bytes -Sum).Sum
    files = @($manifestFiles)
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory "manifest.json") -Encoding utf8NoBOM
Write-Output ("CDN_MEDIA_READY|artifacts:{0}|files:{1}|bytes:{2}|output:{3}" -f `
    $manifest.artifactCount,
    $manifest.fileCount,
    $manifest.totalBytes,
    $OutputDirectory)
