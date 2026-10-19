$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
& npm.cmd ci
if($LASTEXITCODE -ne 0){throw 'npm ci failed.'}
& node.exe (Join-Path $root 'scripts\setup-oauth.mjs')
if($LASTEXITCODE -ne 0){throw 'Keycloak setup failed.'}
$ready=$false
Write-Host 'Waiting for the Keycloak realm...'
for($i=0;$i -lt 60;$i++){
  try{$r=Invoke-WebRequest 'http://localhost:8180/realms/ethical-walls-matter/.well-known/openid-configuration' -UseBasicParsing -TimeoutSec 10;if($r.StatusCode -eq 200){$ready=$true;break}}catch{if($i -eq 0){Write-Host ('Keycloak readiness: '+$_.Exception.Message)}}
  Start-Sleep -Seconds 1
}
if(-not $ready){throw 'Keycloak is not ready. Check Docker Desktop container logs.'}
Write-Host 'Keycloak ready. Stopping earlier launcher-owned apps...'
& (Join-Path $root 'scripts\stop-sql.ps1')
Write-Host 'Starting SQL-backed applications and protected APIs...'
& (Join-Path $root 'scripts\launch-sql.ps1')
