# Ethical Walls Matter Learning Manual

## SQL views service accounts and local OAuth authentication

Edition 1 • 19 October 2026

This manual explains how to build, inspect, and operate the local SQL and OAuth integration. Work through the exercises in order. Each exercise gives the manual interface steps, the equivalent commands where useful, and an expected result. The source files remain the authoritative executable examples.

The implementation uses SQL Server Express and Windows authentication, Docker Desktop running Keycloak, an AM100 administrative application, a vendor application, and a dedicated API host. It is a learning lab on one Windows computer. The existing public demonstration websites are separate deployments and have not been connected to your local SQL Server or Keycloak.

## 1 Understand the connections

The vendor backend requests a token from Keycloak. It sends that token to the AM100 API. The API verifies it before reading SQL views. SQL Server authenticates the Windows identity running the API process. OAuth does not replace that SQL identity.

| Component | Address or identity | Responsibility |
| --- | --- | --- |
| Keycloak | http://localhost:8180 | Issue signed access tokens |
| AM100 administration | http://localhost:4311 | Edit clients matters people rules and flags |
| MatterSpace vendor | http://localhost:4312 | Request validation and create eligible workspaces |
| AM100 integration API | http://localhost:4313 | Accept authorized integration requests |
| SQL Server | .\SQLEXPRESS | Store authoritative records |
| Database | AM100IntegrationDemo | Hold tables views roles and audit procedure |

There are two different service accounts. The vendor service account is the Keycloak client `matterspace-vendor`. It has no Windows login or SQL user. The AM100 API service account is the Windows identity `YOURPC\svc_AM100Api`, which you will create manually later. Its SQL database user belongs to `Am100ApiReader`.

For the initial working setup, all Node processes use your current Windows account. That verifies functionality but does not demonstrate operating-system identity isolation. The manual account exercise separates the API process from the administrative process.

An employee in `dbo.FirmUsers` is a business record. Employee numbers stay on the firm side. Email is the unique identifier used when the vendor asks about ethical walls. Adding an employee does not create a SQL login or a Keycloak account.

## 2 Check the prerequisites

1. Install Node.js 22 or later, Git, SQL Server Express, SSMS, Microsoft sqlcmd, and Docker Desktop. The main README includes installation links and Windows SQL setup details.
2. Open Docker Desktop. Wait until its Linux engine reports that it is running. Complete any first-run installation or licensing prompts yourself.
3. Open SSMS and connect to `.\SQLEXPRESS` using Windows Authentication.
4. Confirm `AM100IntegrationDemo` exists under Databases. If this is a fresh clone, run `Start-AM100.bat` once to create the original schema and seed records, then `Stop-AM100.bat` before starting the OAuth lab.
5. Open PowerShell in the project folder. Use a regular terminal unless a particular Windows account operation requests elevation.

```powershell
Set-Location 'C:\LLMs and Scripts\AI_CM_EW'
node --version
npm.cmd ci
docker version
sqlcmd -S '.\SQLEXPRESS' -E -C -b -Q 'SELECT @@SERVERNAME;'
```

Expected result: Node runs, the npm dependency installs from the lockfile, Docker reports both Client and Server, and SQL returns a server name. If your instance has a different name, set `$env:AM100_SQL_SERVER` before launching the lab. The `-C` option is for this local SQL certificate setup; configure trusted certificates for a deployed service.

Port 8080 was occupied on the development computer. Keycloak therefore uses port 8180. Keep the issuer URL identical in Keycloak tokens and API configuration. `localhost` and `127.0.0.1` are different issuer strings even when both reach this computer.

## 3 Start the complete lab

1. Stop an earlier launcher-owned application process with `Stop-AM100.bat`. It leaves SQL Server running.
2. Double-click `Start-OAuth.bat` in File Explorer.
3. Wait for npm installation, Keycloak container startup, SQL view setup, and application startup.
4. The firm and vendor pages open. SSMS opens the inspection script when available.
5. Open http://localhost:8180/admin/ to inspect Keycloak.

The equivalent individual operations are:

```powershell
npm.cmd ci
npm.cmd run setup:oauth
# Wait for the realm discovery page to respond before proceeding.
Invoke-RestMethod 'http://localhost:8180/realms/ethical-walls-matter/.well-known/openid-configuration'
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i .\sql\api-views.sql
npm.cmd start
```

`npm start` runs in the foreground. Leave that terminal open; press Ctrl+C to stop it. Use a second PowerShell window for exercises. Do not run the batch launcher while the foreground applications own the same ports.

The setup creates random credentials in `.local-data/oauth/config.json`, a realm import in `.local-data/oauth/import/realm.json`, and a Docker Compose file in `.local-data/oauth/compose.json`. These are ignored by Git. The Keycloak database persists in the Docker volume `ethical-walls-matter_keycloak-data`.

To read your initial admin password, open the local config file in an editor. The login name is `admin`; the value named `KEYCLOAK_ADMIN_PASSWORD` is its initial password. Do not paste that file into GitHub, screenshots, or support messages. The API host needs public issuer and audience configuration, not this admin password.

Repeated setup preserves the existing realm. Editing the generated import file does not update a realm that already exists. Use the console for later role or credential changes.

## 4 Inspect the database manually in SSMS

1. In Object Explorer, expand Databases, then `AM100IntegrationDemo`.
2. Expand Tables. Inspect `dbo.Clients`, `dbo.Matters`, `dbo.ClientMatters`, `dbo.FirmUsers`, `dbo.EthicalWallRules`, `dbo.MatterFlags`, and `dbo.FlagPolicies`.
3. Right-click a table and choose Select Top 1000 Rows to read it. Avoid Edit Top 200 Rows until you intend to change records.
4. Expand Views. Right-click Views and choose Refresh if the `api` views are not visible.
5. Right-click `api.ClientMatters`, then Select Top 1000 Rows.
6. Expand Programmability, Stored Procedures to find `api.AppendAudit`.
7. Expand Security, Roles, Database Roles to find `Am100ApiReader`.

| API object | Data exposed |
| --- | --- |
| api.Clients | Client identifier name and active status |
| api.ClientMatters | Client matter association and active validity |
| api.Users | Email and active status only |
| api.EthicalWalls | Matter specific allow and deny rules |
| api.Settings | Policy mode revision availability and flag enforcement |
| api.MatterFlags | Flags assigned to a client matter |
| api.FlagPolicies | Configured workspace restrictions |
| api.AppendAudit | Append a single API activity record |

The view is a stored query. It returns current underlying data; it does not copy the rows into a second table. SQL permissions on the view do not decide ethical-wall membership. The API evaluates that business policy using the view results.

## 5 Create the views manually

### Run the supplied SQL through SSMS

1. In SSMS choose File, Open, File and select `sql\api-views.sql` from the project.
2. Check that the query window is connected to the intended local SQL instance.
3. Read the script. It creates the `api` schema, seven views, one procedure, and one database role. It does not create a Windows account or replace business records.
4. Choose Execute or press F5.
5. Check the Messages tab for errors.
6. Refresh Views, Stored Procedures, and Database Roles in Object Explorer.

This is a manual operation in SSMS even though the supplied script contains multiple SQL statements. The launcher performs the same installation for convenience.

### Build a practice view using the graphical designer

1. Under `AM100IntegrationDemo`, right-click Views and choose New View.
2. Add the `Clients`, `ClientMatters`, and `Matters` tables. Depending on the SSMS version, use Add Table or the Add Tables pane.
3. Verify the joins: `Clients.ClientId` to `ClientMatters.ClientId`, and `ClientMatters.MatterKey` to `Matters.MatterKey`. Remove any incorrect joins.
4. Select `Clients.ClientId`, `Clients.ClientName`, `Clients.IsActive`, `Matters.MatterNumber`, `Matters.MatterName`, and `Matters.IsActive`.
5. In the grid set aliases for the two IsActive columns to `ClientActive` and `MatterActive`. Use View Designer, Pane, SQL if you need to display the SQL text.
6. Save as `vwPracticeClientMatter` under the default `dbo` schema. Keep this practice object separate from the application views.
7. Close the designer and refresh Views. Right-click the practice view and choose Select Top 1000 Rows.

Equivalent practice SQL:

```sql
USE AM100IntegrationDemo;
GO
CREATE OR ALTER VIEW dbo.vwPracticeClientMatter AS
SELECT c.ClientId, c.ClientName,
       c.IsActive AS ClientActive,
       m.MatterNumber, m.MatterName,
       m.IsActive AS MatterActive
FROM dbo.ClientMatters cm
JOIN dbo.Clients c ON c.ClientId = cm.ClientId
JOIN dbo.Matters m ON m.MatterKey = cm.MatterKey;
GO
SELECT TOP (100) * FROM dbo.vwPracticeClientMatter;
```

Creating a new practice view does not automatically change an API query. The application's API read definitions are in `src/api-sql-store.mjs`; the installed application views are defined in `sql/api-views.sql`. Keep their column names consistent when experimenting. Change the source SQL file as well as the live view when you want a lasting change, because the launcher reapplies the source definition.

## 6 Create the Windows service account yourself

This exercise creates the AM100 API process identity. The vendor continues to use OAuth and receives no database account.

1. Find your computer name under Windows Settings, System, About. In the examples replace `YOURPC` with that name.
2. Sign in with an account allowed to administer local users.
3. Open Computer Management as administrator. Expand Local Users and Groups, Users.
4. Right-click Users and choose New User.
5. Enter user name `svc_AM100Api`, a descriptive full name, and a strong password you retain securely.
6. Clear User must change password at next logon for this unattended lab identity. Do not select Password never expires by default; manage rotation deliberately.
7. Choose Create, then Close. Open the new account's properties and confirm it is not a member of Administrators.
8. If your Windows edition lacks Local Users and Groups, use the PowerShell equivalent below. A domain-managed deployment should use an organization-approved service identity, such as a gMSA, instead of copying this local-account pattern.

Run the equivalent creation commands in an administrator PowerShell window. They prompt for the password without including it in a command line:

```powershell
$servicePassword = Read-Host 'Password for svc_AM100Api' -AsSecureString
New-LocalUser -Name 'svc_AM100Api' `
  -Password $servicePassword `
  -Description 'Ethical Walls Matter API SQL identity'
Get-LocalGroupMember -Group 'Administrators'
```

Expected result: the account exists and is not an administrator. Creating it does not grant access to SQL Server. Do not create a second Windows account for the vendor.

## 7 Map the account to SQL using SSMS

### Create a server login

1. Connect to SQL Server in SSMS using your administrative identity.
2. Under the server root, expand Security. Right-click Logins, then New Login.
3. Select Windows authentication.
4. Enter `YOURPC\svc_AM100Api`. Alternatively choose Search, Locations, select your computer, enter `svc_AM100Api`, then Check Names.
5. Set Default database to `AM100IntegrationDemo`.
6. On Server Roles leave only the normal public membership. Do not select sysadmin.

### Map the database user and role

1. In the same New Login dialog select User Mapping.
2. Check `AM100IntegrationDemo` in the database list.
3. Confirm the user name is `YOURPC\svc_AM100Api`; the default schema can be `dbo`.
4. In Database role membership, check `Am100ApiReader`. Public membership is normal. Do not check db_owner, db_datareader, or db_datawriter.
5. Choose OK.
6. Expand the database's Security, Users and inspect the new user. Open Properties, Membership and confirm `Am100ApiReader`.

If you already created the login, open its Properties and use User Mapping instead of creating another login. If the custom role is missing, execute `sql\api-views.sql` first.

Equivalent SQL is supplied in `sql/api-service-account.example.sql`. Replace YOURPC before executing it:

```sql
USE master;
GO
CREATE LOGIN [YOURPC\svc_AM100Api] FROM WINDOWS;
GO
USE AM100IntegrationDemo;
GO
CREATE USER [YOURPC\svc_AM100Api]
  FOR LOGIN [YOURPC\svc_AM100Api];
GO
ALTER ROLE Am100ApiReader
  ADD MEMBER [YOURPC\svc_AM100Api];
```

### Grant one view manually through the interface

To understand the object-level permission behind the supplied role:

1. Expand the database's Security, Roles, Database Roles.
2. Open Properties for `Am100ApiReader`.
3. Select Securables, Search, Specific objects, then Object Types and check Views.
4. Browse or enter `api.ClientMatters`, confirm it, and select the view in Securables.
5. In Explicit permissions check Grant for Select. Leave With Grant unchecked. Choose OK.
6. For the API's complete role, the source script grants SELECT on all seven named views and EXECUTE on `api.AppendAudit`.

Equivalent single-object permission:

```sql
GRANT SELECT ON OBJECT::api.ClientMatters TO Am100ApiReader;
GRANT EXECUTE ON OBJECT::api.AppendAudit TO Am100ApiReader;
```

These views, their source tables, and the procedure share the database owner through their schemas. Ownership chaining allows the intended access through those objects. Do not grant broad table permissions to fix an unrelated login or connection problem. The role has no permission to alter client records or directly read employee numbers.

## 8 Test the SQL permissions

1. In SSMS open `sql\test-api-permissions.sql`.
2. Execute it as an administrator. It creates a temporary database user without a server login, joins it to the API role, reads API views, checks denied table permissions, and calls the audit procedure.
3. Confirm the final PASS message. Its transaction is rolled back, including the test user and audit row.
4. This verifies the database role, not Windows authentication or file access for your new account.
5. To test the actual service account, open a terminal under it with `runas`, run `whoami`, and connect using Windows authentication.

```powershell
runas /user:YOURPC\svc_AM100Api powershell.exe
# In the new window:
whoami
sqlcmd -S '.\SQLEXPRESS' -E -C -b -d AM100IntegrationDemo `
  -Q 'SELECT TOP (1) * FROM api.ClientMatters;'
```

Expected result: the view query succeeds. A direct query against `dbo.FirmUsers` should report a permission error for this account. If it succeeds, inspect the login's other server roles, database roles, Windows groups, and explicit grants. Permission membership is additive; the narrow role does not remove preexisting privileges.

## 9 Run the API under that Windows identity

First grant the service account Read and execute permission to the project source folder and the installed Node.js executable using File Explorer, Properties, Security, Edit, Add. Limit the file permissions to what is needed; do not grant Modify. If the folder inherits access to `.local-data`, restrict that folder separately so this API identity cannot read vendor and Keycloak admin credentials. Do not remove your own access. Windows ACL changes depend on the folder's inherited permissions and should be reviewed before applying.

1. Stop the launcher-owned applications with `Stop-AM100.bat`, or press Ctrl+C if you used foreground `npm start`.
2. Keep Keycloak running.
3. Open PowerShell using `runas /user:YOURPC\svc_AM100Api powershell.exe`. Enter the password when Windows requests it.
4. In that window run the public-configuration script below. It starts the API only on port 4313 and never loads the vendor or admin secrets.

```powershell
Set-Location 'C:\LLMs and Scripts\AI_CM_EW'
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\run-api-service.example.ps1
```

5. In your original Windows account's PowerShell window start the admin and vendor applications with the external API option:

```powershell
Set-Location 'C:\LLMs and Scripts\AI_CM_EW'
$env:AM100_EXTERNAL_API = 'true'
npm.cmd start
```

6. Verify the API service window remains running, then use `npm.cmd run check:oauth` in a third terminal under your normal account.

The separate API uses your new Windows identity because `scripts/sql-bridge.ps1` uses Integrated Security and inherits the process identity. Changing an environment variable containing a Windows user name would not switch identities. The initial all-in-one launcher is a convenience mode; the two-window arrangement is the identity-isolation exercise. For unattended operation, configure Windows Task Scheduler to run the API script under that account, with a fully qualified Node executable path and the project working directory. Store the task's credential through Windows rather than in this repository. Grant Log on as a batch job if your organization's policy requires it.

## 10 Recreate the OAuth configuration manually

The automated setup already creates the realm and clients. Inspect those existing objects first. To reproduce them entirely manually, start a separate empty Keycloak installation or create a separate practice realm and update its issuer consistently. Do not delete the working realm to practice.

### Inspect or create the realm

1. Open http://localhost:8180/admin/ and sign in as admin using your local credential file.
2. Use the realm selector at the top left. Select `ethical-walls-matter` if it exists. For an empty installation choose Create realm and enter that name.
3. Under Realm settings, Tokens, set Access Token Lifespan to five minutes for this lab.

### Define the API and its permissions

1. Choose Clients, Create client. Select OpenID Connect, enter Client ID `am100-api`, then Next.
2. Disable interactive flows and direct access grants; this client represents a resource API. Save.
3. Open that client's Roles tab. Create `ClientMatter.Validate`, then `EthicalWalls.Check`, with those exact names and capitalization.

### Create the vendor service account

1. Choose Clients, Create client. Use OpenID Connect and Client ID `matterspace-vendor`.
2. Enable Client authentication. Enable Service accounts roles. Disable Standard flow, Implicit flow, and Direct access grants. Save.
3. Open Credentials and retain its client secret securely for the vendor backend. Do not place it in UI JavaScript.
4. Open Service account roles, Assign role, filter by clients, and select both roles belonging to `am100-api`. Assign them.
5. Open Client scopes and select the vendor's dedicated client scope, typically named `matterspace-vendor-dedicated`.
6. On Scope, keep Full scope allowed off. Assign the two `am100-api` roles as explicit role scope mappings. Token roles are limited by both this scope and the service account's assignments.

### Configure the audience and role claims

1. Within the dedicated scope choose Mappers, Configure a new mapper, Audience.
2. Name it `am100-audience`. Set Included Client Audience to `am100-api`. Enable Add to access token and leave Add to ID token off. Save.
3. To explicitly map the API roles, create a User Client Role mapper named `api-roles`.
4. Set Client ID to `am100-api`, Token Claim Name to `resource_access.am100-api.roles`, Claim JSON Type to String, Multivalued on, and Add to access token on. Save.
5. Verify the vendor client's default scopes include `roles`. The supplied import uses explicit mappings as well as this standard scope.

If you regenerated the vendor secret or created these objects manually, update only `AM100_OAUTH_CLIENT_SECRET` in the ignored local config file and restart the vendor process. The API verifier does not need the vendor secret. A Keycloak client secret change does not update the local file automatically.

## 11 Request a token manually

Use a normal PowerShell terminal, not the restricted API service account. This example reads local credentials into memory without printing them:

```powershell
$lab = Get-Content .\.local-data\oauth\config.json -Raw |
  ConvertFrom-Json
$tokenEndpoint = $lab.AM100_OAUTH_ISSUER +
  '/protocol/openid-connect/token'
$tokenReply = Invoke-RestMethod -Method Post `
  -Uri $tokenEndpoint -ContentType 'application/x-www-form-urlencoded' `
  -Body @{
    grant_type = 'client_credentials'
    client_id = $lab.AM100_OAUTH_CLIENT_ID
    client_secret = $lab.AM100_OAUTH_CLIENT_SECRET
  }
$apiHeaders = @{ Authorization = 'Bearer ' + $tokenReply.access_token }
```

Expected result: a Bearer access token with a limited lifetime. No employee login is involved. The vendor backend performs the same exchange automatically, caches its token, and requests a new one before expiry. Client credentials flow does not require an interactive login or a refresh token in this implementation.

The API accepts RS256 tokens issued by the exact configured realm, intended for `am100-api`, still within their lifetime, and containing the appropriate client role. It downloads public signing keys from the realm's JWKS endpoint. It does not trust an unsigned token or merely decode a JWT and accept its contents.

## 12 Call both APIs manually

Continue in the same PowerShell window so `$apiHeaders` is available.

```powershell
$matterRequest = @{
  clientId = '1001'
  matterId = '001'
  environment = @{
    hosting = 'on-premises'
    region = 'US'
    aiEnabled = $false
    externalSharing = $false
  }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:4313/api/client-matter-validations' `
  -Headers $apiHeaders -ContentType 'application/json' `
  -Body $matterRequest

$wallsRequest = @{
  clientId = '1001'
  matterId = '001'
  emails = @('alex.morgan@am100.example','jordan.lee@am100.example')
} | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:4313/api/ethical-walls' `
  -Headers $apiHeaders -ContentType 'application/json' `
  -Body $wallsRequest
```

An HTTP 200 validation response is not automatically permission to create a workspace. The vendor requires both `valid=true` and `workspaceAllowed=true`, then checks each proposed member. Existing seed records normally approve Alex and exclude Jordan; firm edits may change that result. Employee numbers never appear in these API responses.

To check authentication, repeat without `-Headers $apiHeaders`: expect HTTP 401. A valid token without the endpoint's required role receives HTTP 403. The batch validation endpoint requires `ClientMatter.Validate` as well.

## 13 Use Swagger and the applications

1. Open the AM100 site at http://localhost:4311. Follow its Swagger hyperlinks, which open new tabs.
2. The client matter docs are at http://localhost:4311/docs/client-matter-validations and ethical walls docs at http://localhost:4311/docs/ethical-walls. Equivalent pages are available directly on port 4313.
3. Run the token-request exercise. For Swagger only, copy `$tokenReply.access_token` to the clipboard without sharing it. Treat it as a short-lived credential.
4. In Swagger choose Authorize. Paste the raw access token; the HTTP Bearer scheme adds the prefix. Choose Authorize, then Close.
5. Expand POST, choose Try it out, fill the JSON body, and Execute. Expect an authenticated response. Authorization expires with the token; repeat the token exercise when necessary.
6. The browser's request is proxied from the firm site to the API host while preserving its token. The proxy never substitutes vendor credentials to bypass authentication.
7. In AM100 create or edit a client and matter, assign flags, and edit employee access rules. In vendor create a workspace for that client matter with allowed and restricted emails.
8. Inspect the returned API trace and resulting members. Invalid matters and incompatible environments block creation; restricted people are excluded. At least one eligible member is required.
9. Change an ethical-wall rule, then recheck the workspace to see membership change. If verification becomes unavailable, recheck suspends access.

## 14 Understand the source code

| File | Responsibility |
| --- | --- |
| sql/api-views.sql | Seven purpose built API views role and audit procedure |
| sql/api-service-account.example.sql | Manual Windows login and SQL user mapping template |
| sql/test-api-permissions.sql | Reversible role permissions exercise |
| src/api-sql-store.mjs | Load a consistent firm snapshot from API views and append audit |
| scripts/sql-bridge.ps1 | Parameterized SQL commands under Windows authentication |
| src/oauth.mjs | Verify signed tokens and obtain cached vendor tokens |
| scripts/setup-oauth.mjs | Generate local secrets realm import and persistent Docker configuration |
| scripts/oauth-config.mjs | Load ignored local configuration with environment overrides |
| scripts/api.mjs | Dedicated integration API entry point |
| scripts/run-api-service.example.ps1 | Public configuration for the separate Windows API process |
| scripts/server.mjs | HTTP host authentication gate API isolation and firm proxy |
| src/core.mjs | Validation flags ethical walls and workspace business logic |
| src/swagger.mjs | OpenAPI documentation and Bearer authorization description |
| scripts/dev-sql.mjs | Start local apps with embedded or external API host |
| tests/oauth.test.mjs | Automated token rejection role isolation and vendor behavior tests |

The API store reads all seven views inside one serializable SQL transaction. It evaluates business decisions using that snapshot and records audit events through `api.AppendAudit`. The audit procedure increments the internal storage version so concurrent administrative saves retry instead of overwriting newly appended events. The policy revision remains separate and lets the vendor detect a firm policy change between its two calls.

The existing administrative app retains its original broader write store. The dedicated API host has no `/api/admin`, `/api/state`, or vendor workspace endpoints. SQL read privileges alone do not protect an HTTP route: the token gate runs before the integration handler.

## 15 Test your changes

```powershell
npm.cmd test
npm.cmd run test:sql
npm.cmd run check:oauth
npm.cmd run build
sqlcmd -S '.\SQLEXPRESS' -E -C -b `
  -i .\sql\test-api-permissions.sql
```

`npm test` uses isolated HTTP servers and signed test tokens; it does not require Keycloak or SQL. `test:sql` uses your local database and creates temporary business fixtures, then removes them. `check:oauth` requires the live Keycloak realm and API on port 4313; it verifies HTTP 401 without a token and HTTP 200 for authorized requests to both APIs. The permission script rolls back its changes. Run SQL integration tests when no other administrator is editing records.

The Worker build checks the existing hosted demonstration artifacts. It does not deploy the local OAuth host, SQL Server, or Keycloak to the public websites.

## 16 Troubleshoot by connection

| Symptom | Check |
| --- | --- |
| Docker reports no engine | Start Docker Desktop and select the Linux engine |
| Port 8180 cannot bind | Inspect the existing listener and Windows excluded port ranges before changing the issuer and Compose mapping together |
| Realm discovery is unavailable | Check the Keycloak container logs and realm import success |
| Token endpoint returns invalid_client | Confirm client ID secret client authentication and service account setting |
| API returns 401 | Check token expiry exact issuer audience signature algorithm and current signing key |
| API returns 403 | Check both service account role assignment and client role scope mappings |
| SQL login failed | Run whoami in the API window and confirm the corresponding server login and database mapping |
| SQL SELECT permission denied | Confirm Am100ApiReader membership and installed API views |
| SQL EXECUTE permission denied | Confirm permission on api.AppendAudit without granting broad write roles |
| Admin saves work but vendor fails | Check port 4313 Keycloak configuration and vendor token acquisition |
| Launcher reuses old process | Stop its recorded process with Stop-AM100.bat and relaunch after configuring OAuth |
| API port already in use | Stop the old owned process or use the external API setting for a separately started API |
| Generated realm edits have no effect | Existing realms are not overwritten by startup import use the console |

The launcher logs are under `.local-data`. Do not log tokens, client secrets, or Authorization headers when diagnosing problems. The application traces record the business payload and response, not those credentials.

## 17 Stop restart and rotate credentials

1. Use `Stop-AM100.bat` to stop a launcher-owned application process. For foreground processes use Ctrl+C in each window.
2. In Docker Desktop select the lab Keycloak container and Stop. This preserves its volume. Use Start to restart it, or run `npm.cmd run setup:oauth`.
3. To rotate a vendor secret, regenerate it in Keycloak, update the ignored local config file, and restart the vendor backend. Existing signed access tokens may remain valid until expiry.
4. Rotate the Windows service account password through Windows account management and update any scheduled task credentials. Do not put that password in a batch file.
5. For a fresh clone run npm ci before starting Node scripts. Keep package-lock.json under version control and local credentials out of version control.

This lab binds services to loopback and uses Keycloak development mode. Before any shared deployment, configure HTTPS, a production Keycloak database and hostname, protected administrative sign-in, secret storage, operational logging and retention, and separate process identities. The local admin and vendor UIs remain demonstration interfaces without user sign-in; OAuth protects the integration endpoints, not those UI administrator workflows.

## 18 Completion checklist

1. You can explain the difference between a vendor OAuth client, a Windows service account, a SQL login, a SQL database user, a database role, and an employee record.
2. You can create a practice view in the SSMS designer and read its SQL definition.
3. You can map the Windows API account through SSMS and grant view permissions through a custom role.
4. You can run the dedicated API under that account without giving it the vendor secret.
5. You can configure the Keycloak vendor service account manually and assign role scope mappings and an audience.
6. You can request a token, use Swagger, distinguish HTTP 401 from 403, and explain why a valid token does not override a matter or ethical-wall restriction.

## 19 Reference material

The commands above match this repository's implementation. Consult these primary references when extending it:

- Microsoft SQL Server database permissions: https://learn.microsoft.com/en-us/sql/relational-databases/security/authentication-access/getting-started-with-database-engine-permissions
- Microsoft object permissions: https://learn.microsoft.com/en-us/sql/t-sql/statements/grant-object-permissions-transact-sql
- Keycloak Docker installation: https://www.keycloak.org/getting-started/getting-started-docker
- Keycloak administration service accounts role scopes and audience mappers: https://www.keycloak.org/docs/latest/server_admin/index.html
- JOSE token verification library: https://github.com/panva/jose

## 20 Executable SQL reference

The following appendix reproduces `sql/api-views.sql` so you can study the installed objects without switching documents. The service-account mapping code is in section 7. For executable JavaScript and PowerShell, use the source map in section 14 and open those files in your editor; they contain the full working implementation.

```sql
-- Run schema.sql first. This script creates no identities and changes no business records.
USE [AM100IntegrationDemo];
GO
IF SCHEMA_ID(N'api') IS NULL EXEC(N'CREATE SCHEMA api AUTHORIZATION dbo;');
GO
CREATE OR ALTER VIEW api.Clients AS
SELECT ClientId AS id, ClientName AS name, IsActive AS active FROM dbo.Clients;
GO
CREATE OR ALTER VIEW api.ClientMatters AS
SELECT cm.ClientId AS clientId, m.MatterNumber AS id, m.MatterName AS name,
       m.IsActive AS active, m.MatterKey AS matterKey,
       c.IsActive AS clientActive,
       CONVERT(bit, CASE WHEN c.IsActive=1 AND m.IsActive=1 THEN 1 ELSE 0 END) AS isValid
FROM dbo.ClientMatters cm
JOIN dbo.Clients c ON c.ClientId=cm.ClientId
JOIN dbo.Matters m ON m.MatterKey=cm.MatterKey;
GO
-- Employee numbers remain private to the administrative data model.
CREATE OR ALTER VIEW api.Users AS
SELECT Email AS email, IsActive AS active FROM dbo.FirmUsers;
GO
CREATE OR ALTER VIEW api.EthicalWalls AS
SELECT r.RuleId AS id, r.ClientId AS clientId, m.MatterNumber AS matterId,
       r.Email AS email, r.Decision AS effect, r.Reason AS reason
FROM dbo.EthicalWallRules r JOIN dbo.Matters m ON m.MatterKey=r.MatterKey;
GO
CREATE OR ALTER VIEW api.Settings AS
SELECT PolicyMode AS mode, MatterApiAvailable AS matterApi, WallApiAvailable AS wallApi,
       PolicyRevision AS revision, EnforceMatterFlags AS enforceMatterFlags FROM dbo.FirmSettings;
GO
CREATE OR ALTER VIEW api.FlagPolicies AS
SELECT FlagCode AS code, FlagLabel AS label, Description AS description,
       BlockCloud AS blockCloud, BlockAI AS blockAI, BlockExternal AS blockExternal,
       AllowedRegionsJson AS allowedRegionsJson FROM dbo.FlagPolicies;
GO
CREATE OR ALTER VIEW api.MatterFlags AS
SELECT f.ClientId AS clientId, m.MatterNumber AS matterId, f.FlagCode AS flag
FROM dbo.MatterFlags f JOIN dbo.Matters m ON m.MatterKey=f.MatterKey;
GO
-- The API can append one event, but cannot delete or rewrite audit history.
CREATE OR ALTER PROCEDURE api.AppendAudit
  @id nvarchar(64), @at nvarchar(40), @path nvarchar(200), @status int,
  @correlationId nvarchar(100), @requestJson nvarchar(max), @responseJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON;
  IF ISJSON(@requestJson)<>1 OR ISJSON(@responseJson)<>1 THROW 50001, 'Audit JSON is invalid.', 1;
  -- Admin writes also lock this row. Preserve a consistent serialization order.
  DECLARE @version int;
  SELECT @version=VersionNumber FROM dbo.StateVersions WITH (UPDLOCK,HOLDLOCK) WHERE RoleName=N'firm';
  INSERT dbo.AuditLog(EventId,AppRole,EventTime,Endpoint,HttpStatus,CorrelationId,RequestJson,ResponseJson,DurationMs,SortOrder)
  VALUES(@id,N'firm',@at,@path,@status,@correlationId,@requestJson,@responseJson,NULL,
         ISNULL((SELECT MIN(SortOrder)-1 FROM dbo.AuditLog WHERE AppRole=N'firm'),0));
  UPDATE dbo.StateVersions SET VersionNumber=VersionNumber+1 WHERE RoleName=N'firm';
END;
GO
IF DATABASE_PRINCIPAL_ID(N'Am100ApiReader') IS NULL CREATE ROLE Am100ApiReader AUTHORIZATION dbo;
GO
GRANT SELECT ON OBJECT::api.Clients TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.ClientMatters TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.Users TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.EthicalWalls TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.Settings TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.FlagPolicies TO Am100ApiReader;
GRANT SELECT ON OBJECT::api.MatterFlags TO Am100ApiReader;
GRANT EXECUTE ON OBJECT::api.AppendAudit TO Am100ApiReader;
GO

```
