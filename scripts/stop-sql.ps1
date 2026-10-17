$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$pidFile=Join-Path $root '.local-data\sql-apps.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'No launcher-owned application process was recorded.'; exit 0 }
$appProcessId=[int](Get-Content -LiteralPath $pidFile)
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$appProcessId" -ErrorAction SilentlyContinue
$expected=Join-Path $root 'scripts\dev-sql.mjs'
if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine.Contains($expected)) { Stop-Process -Id $appProcessId; Write-Host 'Stopped the SQL-backed apps and APIs. SQL Server and SSMS remain open.' }
elseif ($p) { throw 'Recorded process no longer matches this launcher. No process was stopped.' }
else { Write-Host 'Applications are already stopped.' }
Remove-Item -LiteralPath $pidFile
