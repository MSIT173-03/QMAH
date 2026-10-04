$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '../QMAH.Infrastructure/Services/Economy/MiniGameDetailLocatorScoring.cs'
$prefix = '#nullable enable' + [Environment]::NewLine + 'using System; using System.Collections.Generic; using System.Linq;'
Add-Type -TypeDefinition ($prefix + [Environment]::NewLine + (Get-Content -LiteralPath $source -Raw))
$pool = [Guid[]]@(1..4 | ForEach-Object { [Guid]::Parse(('00000000-0000-0000-0000-{0:000000000000}' -f $_)) })
$sizes = [System.Collections.Generic.Dictionary[Guid, System.ValueTuple[int,int]]]::new()
foreach ($id in $pool) { $sizes[$id] = [System.ValueTuple[int,int]]::new(1000,1000) }

function Assert-Score($Answers, [int]$Expected) {
    $document = [System.Text.Json.JsonDocument]::Parse((@{ locatorAnswers = $Answers } | ConvertTo-Json -Depth 5))
    try {
        $scoreError = $null
        $actual = [QMAH.Infrastructure.Services.Economy.MiniGameDetailLocatorScoring]::Calculate($document.RootElement, $pool, 'v4-test', $sizes, [ref]$scoreError)
        if ($actual -ne $Expected) { throw "預期 $Expected，實際 $actual：$scoreError" }
        if ($Expected -ge 0 -and $scoreError) { throw $scoreError }
    } finally { $document.Dispose() }
}

$forged = @($pool | ForEach-Object { @{ artifactId=$_.ToString(); x=.15; y=.15; targetX=.15; targetY=.15; imageWidth=1000; imageHeight=1000 } })
Assert-Score $forged 0
$correct = @($pool | ForEach-Object {
    $target = [QMAH.Infrastructure.Services.Economy.MiniGameDetailLocatorScoring]::Target('v4-test', $_)
    @{ artifactId=$_.ToString(); x=$target.Item1; y=$target.Item2; imageWidth=1000; imageHeight=1000 }
})
Assert-Score $correct 100
$correct[0].x = '0.5'
Assert-Score $correct -1
$correct[0].x = .5
$correct[0].imageWidth = 999
Assert-Score $correct -1
'4 項定位計分檢查通過：偽造目標、正確答案、座標型別、圖片尺寸。'
