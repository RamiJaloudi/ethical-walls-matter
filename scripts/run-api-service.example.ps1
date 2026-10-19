# Run this script under YOURPC\svc_AM100Api after granting Am100ApiReader.
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$env:AM100_SQL_SERVER='.\SQLEXPRESS'
$env:AM100_OAUTH_ENABLED='true'
$env:AM100_OAUTH_ISSUER='http://localhost:8180/realms/ethical-walls-matter'
$env:AM100_OAUTH_AUDIENCE='am100-api'
$env:AM100_API_PORT='4313'
# API verification uses public signing keys. No vendor or Keycloak admin secret is needed.
& node.exe scripts/api.mjs
exit $LASTEXITCODE
