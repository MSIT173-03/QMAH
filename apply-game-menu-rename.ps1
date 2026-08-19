$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$controllers = Join-Path $root "QMAH.Web\Areas\Game\Controllers"

$changes = @(
    @{
        File = "QuestionEntriesController.cs"
        Old  = '[AdminNavigation("題庫設定", order: 10)]'
        New  = '[AdminNavigation("題庫管理", order: 10)]'
    },
    @{
        File = "RoomsController.cs"
        Old  = '[AdminNavigation("房間", order: 20)]'
        New  = '[AdminNavigation("房間管理", order: 20)]'
    },
    @{
        File = "PlayersController.cs"
        Old  = '[AdminNavigation("玩家", order: 30)]'
        New  = '[AdminNavigation("玩家活動", order: 30)]'
    },
    @{
        File = "RoundsController.cs"
        Old  = '[AdminNavigation("回合", order: 40)]'
        New  = '[AdminNavigation("遊戲紀錄", order: 40)]'
    }
)

foreach ($change in $changes) {
    $path = Join-Path $controllers $change.File

    if (-not (Test-Path $path)) {
        throw "找不到檔案：$path"
    }

    $content = [System.IO.File]::ReadAllText($path)

    if (-not $content.Contains($change.Old)) {
        throw "$($change.File) 找不到預期的 AdminNavigation 設定，已停止修改。"
    }

    $content = $content.Replace($change.Old, $change.New)
    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

$removeNavigation = @(
    @{
        File = "AnswersController.cs"
        Attribute = '[AdminNavigation("作答", order: 50)]'
    },
    @{
        File = "VotesController.cs"
        Attribute = '[AdminNavigation("投票", order: 60)]'
    }
)

foreach ($item in $removeNavigation) {
    $path = Join-Path $controllers $item.File

    if (-not (Test-Path $path)) {
        throw "找不到檔案：$path"
    }

    $content = [System.IO.File]::ReadAllText($path)

    if (-not $content.Contains($item.Attribute)) {
        throw "$($item.File) 找不到預期的 AdminNavigation 設定，已停止修改。"
    }

    $content = $content.Replace($item.Attribute + "`r`n", "")
    $content = $content.Replace($item.Attribute + "`n", "")

    if ($content -notmatch 'AdminNavigation\(') {
        $content = $content.Replace("using QMAH.Web.Infrastructure.AdminNavigation;`r`n", "")
        $content = $content.Replace("using QMAH.Web.Infrastructure.AdminNavigation;`n", "")
    }

    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

Write-Host ""
Write-Host "遊戲功能選單已整理完成：" -ForegroundColor Green
Write-Host "  題庫管理"
Write-Host "  房間管理"
Write-Host "  玩家活動"
Write-Host "  遊戲紀錄"
Write-Host ""
Write-Host "AnswersController 與 VotesController 僅移除功能選單入口，CRUD 仍保留。"
Write-Host "AdminNavigationService.cs 完全沒有修改。"
