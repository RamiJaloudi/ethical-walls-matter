# Third-party notices

The application serves a vendored copy of **Swagger UI Distribution 5.17.14**.

- Upstream: https://github.com/swagger-api/swagger-ui
- npm package: `swagger-ui-dist@5.17.14`
- Upstream license: Apache License 2.0.
- Retained license: [src/vendor/LICENSE](src/vendor/LICENSE).
- Retained notice: [src/vendor/NOTICE](src/vendor/NOTICE).
- Vendored assets: `src/vendor/swagger-ui-bundle.js` and `src/vendor/swagger-ui.css`.

The original project code is available under the [MIT License](LICENSE). Swagger UI retains its own Apache 2.0 license and notice requirements.

The local OAuth host depends on **jose**, maintained at https://github.com/panva/jose and distributed under the MIT license. Its version is pinned by `package-lock.json`.

The optional local OAuth lab runs the **Keycloak** container `quay.io/keycloak/keycloak:26.8.1`. Keycloak is distributed under the Apache License 2.0; see https://github.com/keycloak/keycloak. The container is obtained separately and is not bundled in this repository.
