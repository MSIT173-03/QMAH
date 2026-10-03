$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '../QMAH.Infrastructure/Services/Economy/MiniGamePlacementScoring.cs'
Add-Type -TypeDefinition ('using System;' + [Environment]::NewLine + (Get-Content -LiteralPath $source -Raw))
$cases = @(
    @{ Pieces=25; Seconds=0; Expected=100 },
    @{ Pieces=25; Seconds=300; Expected=100 },
    @{ Pieces=25; Seconds=301; Expected=100 },
    @{ Pieces=25; Seconds=330; Expected=99 },
    @{ Pieces=25; Seconds=450; Expected=95 },
    @{ Pieces=25; Seconds=600; Expected=90 },
    @{ Pieces=25; Seconds=3600; Expected=90 },
    @{ Pieces=15; Seconds=180; Expected=100 },
    @{ Pieces=15; Seconds=198; Expected=99 },
    @{ Pieces=15; Seconds=360; Expected=90 }
)
foreach ($case in $cases) {
    $actual = [QMAH.Infrastructure.Services.Economy.MiniGamePlacementScoring]::Calculate(100, $case.Pieces, $case.Seconds, $case.Pieces, 0, 0, 95)
    if ($actual -ne $case.Expected) { throw "時間評分錯誤：$($case.Pieces) 片，$($case.Seconds) 秒，預期 $($case.Expected)，實際 $actual" }
}
$hinted = [QMAH.Infrastructure.Services.Economy.MiniGamePlacementScoring]::Calculate(100,25,300,25,1,0,95)
if ($hinted -ne 97) { throw '區域提示扣分回歸錯誤' }
$assisted = [QMAH.Infrastructure.Services.Economy.MiniGamePlacementScoring]::Calculate(100,25,300,25,0,1,95)
if ($assisted -ge 95) { throw '代完成不應取得 S 級' }
'12 項時間邊界、提示及代完成評分檢查通過'
