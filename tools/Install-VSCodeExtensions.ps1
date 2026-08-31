[CmdletBinding()]
param()

$extensions = @(
    "ms-dotnettools.csdevkit",
    "ms-dotnettools.csharp",
    "doggy8088.angular-extension-pack",
    "shd101wyy.markdown-preview-enhanced"
)

if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
    Write-Warning "找不到 code 指令；請先將 VS Code 加入 PATH，或稍後手動執行這個安裝腳本。"
    exit 0
}

$installedExtensions = @(code --list-extensions | ForEach-Object { $_.Trim().ToLowerInvariant() })

foreach ($extension in $extensions) {
    if ($installedExtensions -contains $extension.ToLowerInvariant()) {
        Write-Host "VS Code 擴充套件已存在：$extension"
        continue
    }

    Write-Host "安裝 VS Code 擴充套件：$extension"
    & code --install-extension $extension
    if ($LASTEXITCODE -ne 0) {
        throw "VS Code 擴充套件安裝失敗：$extension"
    }
}

Write-Host "QMAH 所需 VS Code 擴充套件已就緒。"
