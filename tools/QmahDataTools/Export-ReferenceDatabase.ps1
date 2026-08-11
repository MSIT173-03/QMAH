[CmdletBinding()]
param(
    [string]$ServerInstance = "(localdb)\MSSQLLocalDB",
    [string]$Database = "QMAH",
    [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
    $OutputDirectory = Join-Path $workspaceRoot "_工具輸出\reference-database"
}

$sqlcmd = Get-Command sqlcmd -ErrorAction Stop
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $OutputDirectory "$Database-reference-$timestamp.bak"
$escapedPath = $backupPath.Replace("'", "''")

& $sqlcmd.Source -b -S $ServerInstance -d master -Q "BACKUP DATABASE [$Database] TO DISK = N'$escapedPath' WITH COPY_ONLY, CHECKSUM, STATS = 10;"
if ($LASTEXITCODE -ne 0) {
    throw "SQL Server 備份失敗。"
}

& $sqlcmd.Source -b -S $ServerInstance -d master -Q "RESTORE VERIFYONLY FROM DISK = N'$escapedPath' WITH CHECKSUM;"
if ($LASTEXITCODE -ne 0) {
    throw "備份已建立，但 RESTORE VERIFYONLY 驗證失敗。"
}

Write-Host "已建立並驗證參考資料庫備份：$backupPath"
