# Working on this project

Start with the README installation and usage guides. The SQL-backed demo is Windows-specific; the isolated application tests and artifact build also run on non-Windows systems.

## Local checks

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

After SQL changes, also run `npm run test:sql` against the dedicated demo database. This test adds uniquely named fictional fixtures, removes their entities afterward, and leaves test audit events. Do not point it at a production database.

For the complete local SQL/OAuth lab, start Docker Desktop with its Linux engine and run `Start-OAuth.bat`; it applies `sql/schema.sql` followed by `sql/api-views.sql`, starts Keycloak, and launches the apps and protected API. Run `npm.cmd run check:oauth` afterward for the live token/API check. Use `sql/test-api-permissions.sql` to verify the restricted database role with rolled-back fixtures. The [Learning Manual](docs/LEARNING-MANUAL.md) covers manual SSMS and Keycloak setup and running the API under a separate Windows identity.

## Change the source, not generated deployments

- `src/ui.mjs`: both web interfaces, CSS, and browser interactions.
- `src/core.mjs`: HTTP handling and business rules.
- `src/flags.mjs`: flag defaults and restriction evaluation.
- `src/swagger.mjs`: OpenAPI definitions and Swagger pages.
- `src/sql-store.mjs` and `scripts/sql-bridge.ps1`: SQL data adapter.
- `sql/schema.sql`: additive SQL schema and views.
- `src/api-sql-store.mjs` and `sql/api-views.sql`: dedicated API view reads, restricted SQL role, and audit procedure.
- `src/oauth.mjs`: access-token verification and vendor client credentials exchange/cache.
- `scripts/setup-oauth.mjs`: local Keycloak provisioning; credentials and generated realm files remain ignored under `.local-data/oauth/`.
- `tests/oauth.test.mjs`: isolated HTTP/token tests that do not require a live provider.

`apps/` contains generated output and separate local deployment repositories. It is intentionally excluded from this source repository. A clean clone must be able to run `npm run build` without those folders already existing.

## Pull request checklist

- Describe the behavior changed and how it was verified.
- Add meaningful tests for policy or API behavior changes.
- Update OpenAPI definitions when request/response fields change.
- Preserve email-based vendor identity and deny precedence.
- Keep schema changes additive; never reset someone's demo records as part of an ordinary migration.
- Never commit credentials, local databases, logs, proprietary input documents, or screenshots containing real data.
- Keep third-party license and notice files with vendored Swagger UI assets.

## GitHub Actions

The included workflow installs locked dependencies with `npm ci`, runs 21 isolated application/OAuth tests, builds fresh artifacts, and checks Worker syntax on Node.js 22. It does not provision SQL Server, start Keycloak, run the live SQL/OAuth checks, or deploy the apps. Run those integration checks locally on Windows with the prerequisites installed.
