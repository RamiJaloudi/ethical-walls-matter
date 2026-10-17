# Working on this project

Start with the README installation and usage guides. The SQL-backed demo is Windows-specific; the isolated application tests and artifact build also run on non-Windows systems.

## Local checks

```powershell
npm test
npm run build
```

After SQL changes, also run `npm run test:sql` against the dedicated demo database. This test adds uniquely named fictional fixtures, removes their entities afterward, and leaves test audit events. Do not point it at a production database.

## Change the source, not generated deployments

- `src/ui.mjs`: both web interfaces, CSS, and browser interactions.
- `src/core.mjs`: HTTP handling and business rules.
- `src/flags.mjs`: flag defaults and restriction evaluation.
- `src/swagger.mjs`: OpenAPI definitions and Swagger pages.
- `src/sql-store.mjs` and `scripts/sql-bridge.ps1`: SQL data adapter.
- `sql/schema.sql`: additive SQL schema and views.

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

The included workflow runs isolated HTTP tests and a fresh build on Node.js 22. It does not provision SQL Server, run SQL integration tests, or deploy the apps. Run the SQL test locally on Windows with the prerequisites installed.
