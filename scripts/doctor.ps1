$ErrorActionPreference='Continue'
Write-Host 'Project prerequisite check' -ForegroundColor Cyan
foreach($name in @('node.exe','npm.cmd','git.exe','sqlcmd.exe','powershell.exe','docker.exe')) {
  $tool=Get-Command $name -ErrorAction SilentlyContinue
  if($tool){Write-Host "[OK] $name : $($tool.Source)"}else{Write-Host "[MISSING] $name" -ForegroundColor Yellow}
}
if(Get-Command node.exe -ErrorAction SilentlyContinue){& node.exe --version}
$server=if($env:AM100_SQL_SERVER){$env:AM100_SQL_SERVER}else{'.\SQLEXPRESS'}
Write-Host "SQL instance: $server"
if($server -eq '.\SQLEXPRESS') {
  $service=Get-Service -Name 'MSSQL$SQLEXPRESS' -ErrorAction SilentlyContinue
  if($service){Write-Host "SQL service: $($service.Status)"}else{Write-Host '[MISSING] SQLEXPRESS service' -ForegroundColor Yellow}
}
if(Get-Command sqlcmd.exe -ErrorAction SilentlyContinue) {
  & sqlcmd.exe -S $server -E -C -b -l 5 -W -h -1 -Q "SET NOCOUNT ON; SELECT 'SQL Windows authentication: OK'; SELECT CASE WHEN DB_ID('AM100IntegrationDemo') IS NULL THEN 'Database: not created yet (run Start-AM100.bat)' ELSE 'Database: present' END;"
  if($LASTEXITCODE -ne 0){Write-Host '[CHECK] SQL connection failed. See the README troubleshooting section.' -ForegroundColor Yellow}
}
foreach($port in @(4311,4312,4313,8180)) {
  $listener=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  Write-Host "Port ${port}: $(if($listener){'in use (PID '+$listener.OwningProcess+')'}else{'available'})"
}
$ssms='C:\Program Files\Microsoft SQL Server Management Studio 22\Release\Common7\IDE\Ssms.exe'
Write-Host "SSMS 22 standard path: $(if(Test-Path -LiteralPath $ssms){'found'}else{'not found; optional for headless startup'})"
