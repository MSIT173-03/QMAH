$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$projects = @(Get-ChildItem -LiteralPath (Join-Path $root 'QMAH.Api'), (Join-Path $root 'QMAH.Web'), (Join-Path $root 'QMAH.Infrastructure'), (Join-Path $root 'tools') -Recurse -File -Filter '*.csproj' |
    Where-Object FullName -NotMatch '[\\/](bin|obj)[\\/]')
if ($projects.Count -eq 0) { throw '找不到 .NET 專案，不能視為稽核成功。' }

$findings = @()
foreach ($project in $projects) {
    Write-Host "Auditing $($project.FullName)"
    & dotnet restore $project.FullName --locked-mode --verbosity quiet
    if ($LASTEXITCODE -ne 0) { throw "Locked restore failed: $($project.Name)" }

    $json = & dotnet list $project.FullName package --vulnerable --include-transitive --format json
    if ($LASTEXITCODE -ne 0) { throw "NuGet audit query failed: $($project.Name)" }
    $audit = ($json -join "`n") | ConvertFrom-Json
    if ($audit.problems -or -not $audit.projects) { throw "NuGet audit incomplete: $($project.Name)" }

    foreach ($result in $audit.projects) {
        foreach ($framework in $result.frameworks) {
            foreach ($package in @($framework.topLevelPackages) + @($framework.transitivePackages)) {
                foreach ($vulnerability in $package.vulnerabilities) {
                    $findings += [pscustomobject]@{
                        Project = $project.Name
                        Package = $package.id
                        Version = $package.resolvedVersion
                        Severity = $vulnerability.severity
                        Advisory = $vulnerability.advisoryurl
                    }
                }
            }
        }
    }
}

if ($findings.Count -gt 0) {
    $findings | Format-Table -AutoSize | Out-Host
    throw "發現 $($findings.Count) 筆 NuGet 弱點；不得略過直接或間接依賴。"
}
Write-Host "NuGet audit passed: $($projects.Count) projects, direct and transitive dependencies."
