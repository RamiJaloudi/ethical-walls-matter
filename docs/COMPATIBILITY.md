# API compatibility and deployment boundaries

The OpenAPI pages document the working demonstration API. They are not a claim of compatibility with a particular enterprise integration product.

## Demo contracts

- Client/matter IDs are strings, preserving leading zeros and allowing alphanumeric identifiers.
- Single CM validation accepts one object; the separate batch endpoint accepts 1–100 objects.
- Matter validation returns `valid`; workspace compatibility is separately reported by `workspaceAllowed` and `environmentChecked`.
- Ethical wall checks accept a list of emails and return one result per normalized email.
- Employee numbers belong to the firm directory and are not used by the vendor.
- `X-Correlation-ID` is the primary tracing header; `correlationId` is an accepted alias for firm validation. `transactionId` is not implemented.
- Health reports observed availability. Connection-pool statistics and response-time averages are not implemented.

Legacy routes, different field names, integer IDs, single-person `allowAccess` responses, and external OAuth providers require explicit adapters/configuration. Do not point an existing enterprise vendor at the demo and assume wire compatibility.

## Local SQL Server versus hosted D1

The recommended Windows setup uses SQL Server Express and SQL views. The optional generated Cloudflare Workers use D1 and have separate data. Worker builds do not carry the local SQL database, Windows credentials, or database files with them.

The project does not establish a secure route from a hosted Worker to a database on someone's PC. Moving the SQL-backed application to a shared environment requires an appropriate application host, protected database connectivity, application authentication, and authorization.

## Production work still required

- Authentication/administrator roles for the local HTTP APIs, tenant isolation, and narrower service scopes.
- Trusted vendor hosting/region/feature configuration rather than editable simulation inputs.
- Automatic membership reconciliation after firm policy changes.
- Authorization on every document/resource operation, beyond this workspace-creation demonstration.
- Targeted SQL row operations, persistent connection pooling, operational telemetry, and durable audit retention.
- Production secrets management, TLS, rate limits, validation limits agreed with consumers, and recovery procedures.

No proprietary reference specifications, local document extracts, deployment identities, or machine-specific review reports are included in the public repository.
