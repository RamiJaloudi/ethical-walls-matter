$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
if (-not $env:AM100_SQL_SERVER) { $env:AM100_SQL_SERVER = '.\SQLEXPRESS' }
try {
  Get-Command node.exe, sqlcmd.exe -ErrorAction Stop | Out-Null
  if ($env:AM100_SQL_SERVER -eq '.\SQLEXPRESS') {
    $service = Get-Service -Name 'MSSQL$SQLEXPRESS'
    if ($service.Status -ne 'Running') { Start-Service -Name 'MSSQL$SQLEXPRESS' }
  }
  Write-Host 'Preparing AM100IntegrationDemo database and SQL views...'
  & sqlcmd.exe -S $env:AM100_SQL_SERVER -E -C -b -i (Join-Path $root 'sql\schema.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Database setup failed.' }
  & node.exe (Join-Path $root 'scripts\setup-sql.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Could not initialize SQL demo records.' }
  $nodePath = (Get-Command node.exe).Source
  $entry = Join-Path $root 'scripts\dev-sql.mjs'
  $logDirectory = Join-Path $root '.local-data'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $pidPath=Join-Path $logDirectory 'sql-apps.pid'
  $process=$null
  if (Test-Path -LiteralPath $pidPath) {
    $recordedId=[int](Get-Content -LiteralPath $pidPath)
    $recorded=Get-CimInstance Win32_Process -Filter "ProcessId=$recordedId" -ErrorAction SilentlyContinue
    if ($recorded -and $recorded.Name -eq 'node.exe' -and $recorded.CommandLine.Contains($entry)) { $process=Get-Process -Id $recordedId }
  }
  # Reuse only our recorded SQL-backed process, never an unrelated or JSON-backed app.
  foreach ($port in @(4311,4312)) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener -and (-not $process -or $listener.OwningProcess -ne $process.Id)) { throw "Port $port is in use by another application. Stop that application before launching this demo." }
  }
  $startedNow=$false
  if (-not $process) {
    $process = Start-Process -FilePath $nodePath -ArgumentList @('"' + $entry + '"') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'sql-apps.log') -RedirectStandardError (Join-Path $logDirectory 'sql-apps-error.log')
    $startedNow=$true
  } else { Write-Host 'Reusing the SQL-backed applications already started by this launcher.' }
  $ready = $false
  for ($attempt=0; $attempt -lt 40; $attempt++) {
    if ($process.HasExited) { throw ('Application startup failed. See ' + (Join-Path $logDirectory 'sql-apps-error.log')) }
    try {
      $a=Invoke-WebRequest 'http://localhost:4311/api/state' -UseBasicParsing -TimeoutSec 12
      $b=Invoke-WebRequest 'http://localhost:4312/api/state' -UseBasicParsing -TimeoutSec 12
      if ($a.StatusCode -eq 200 -and $b.StatusCode -eq 200) { $ready=$true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ready) { if($startedNow){Stop-Process -Id $process.Id}; throw 'Applications did not become ready. Review .local-data logs.' }
  $process.Id | Set-Content (Join-Path $logDirectory 'sql-apps.pid')
  Start-Process 'http://localhost:4311'
  Start-Process 'http://localhost:4312'
  $ssms='C:\Program Files\Microsoft SQL Server Management Studio 22\Release\Common7\IDE\Ssms.exe'
  if (-not (Test-Path -LiteralPath $ssms)) { $ssms=(Get-Command Ssms.exe -ErrorAction SilentlyContinue).Source }
  if ($ssms) {
    # A visible SSMS window is requested so the user can inspect the DB and tables.
    $inspection=Join-Path $root 'sql\Inspect-AM100.sql'
    Start-Process -FilePath $ssms -ArgumentList @(('"'+$inspection+'"'),'-S',('"'+$env:AM100_SQL_SERVER+'"'),'-d','AM100IntegrationDemo','-C','-nosplash')
  } else { Write-Warning 'SSMS was not found. Open sql\Inspect-AM100.sql in your SQL management app.' }
  Write-Host "Apps and APIs are running. SQL Server: $env:AM100_SQL_SERVER / AM100IntegrationDemo"
  Write-Host 'In SSMS expand AM100IntegrationDemo > Tables and Views. Press F5 in Inspect-AM100.sql to inspect data.'
} catch { Write-Error $_; exit 1 }
