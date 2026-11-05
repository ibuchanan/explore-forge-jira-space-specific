# Development

This is a Forge UI Kit app. The admin page chooses Jira projects; its
resolver creates, updates, or deletes a dynamic issue panel. The panel
resource displays `peek-a-boo`. For the user-facing first run, start with
the [README](README.md) and [tutorial](docs/tutorials/tutorial.md).

## Local development loop

Use Node.js 24 (see `.nvmrc`), npm, and the
[Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/).
From the repository root:

```sh
npm install
npm run test
npm run check
```

`npm run test` runs the Vitest resolver tests in `src/resolvers/index.test.ts`.
`npm run check` runs lint (Biome, Forge lint, ast-grep rules, formatting, and
TypeScript typecheck), tests, and the bundle-size check. It does not deploy
or install the app. For focused work, use `npm run typecheck`,
`npm run lint:docs`, or `npm run test:watch`. `npm run format` changes files;
`npm run format:check` only checks them. Run `npm run check` before submitting
changes. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process.

## First-time Forge setup with Fence Rider

The `forge:*` package scripts use [Fence Rider][fence-rider] to wrap the
Forge CLI. It resolves configuration declared in `secretspec.toml` through
[SecretSpec](https://secretspec.dev) and your chosen provider. Local controls
select the site, product, and environment. This app declares no runtime
variables to upload; Fence Rider is development tooling, not part of the
deployed app.
1. Install the tools described in Fence Rider's
   [installation guide][installation]. Dependency installation supplies
   Fence Rider, but Bun, SecretSpec, and the Forge CLI must also be on `PATH`.
   [Authenticate with Forge][forge-setup], then check the installed tools:

   ```sh
   bun run fence-rider doctor
   ```

2. Confirm access to the app and development site you intend to use. This
   repository already contains an `app.id` in `manifest.yml`. If this copy
   needs a separate registration, run `npm run forge:register` **once**; it
   replaces the app ID and disconnects this copy from the original app's
   environments, variables, and storage. Do not re-register an app you own
   or are authorized to develop.

3. Follow [workstation provider setup][providers] and review this repository's
   `secretspec.toml`. Store values in an approved provider, not in source
   files or committed local-value files. Configure `FORGE_SITE` for your
   development site; `FORGE_PRODUCT` defaults to `jira` and
   `FORGE_ENVIRONMENT` to `development`. These controls are local and must
   not be uploaded as runtime variables. Check that configuration resolves
   without printing secret values:

   ```sh
   SECRETSPEC_PROFILE=default bun run fence-rider doctor --resolve
   ```

   This may authenticate with your provider. It does not display or confirm
   the target values; review those separately. For provider routing and
   manifest inputs, see [app secret storage][app-secrets],
   [local target settings][local], and [manifest configuration][manifest].

4. When authorized to change the configured app and site, deploy to
   development and install on Jira:

   ```sh
   npm run forge:deploy
   npm run forge:install
   ```

   **These commands change remote state.** `forge:variables:set` is unnecessary
   for this repository's current configuration. For subsequent source changes,
   deploy again; after scope changes, deploy and use `npm run forge:upgrade`
   for existing installations. Keep the same configured environment for each
   command. See [runtime workflows][runtime] and
   [installation management][forge-tooling] for details. Do not deploy or
   install without approval in this repository's development workflow.

## Where to make changes

- `manifest.yml`: static Jira admin page and resolver, UI resources, runtime,
  and scopes. The issue panel is registered dynamically, not listed here as a
  static module.
- `src/frontend/index.tsx`: admin UI, including the unapplied project list
  and Apply action.
- `src/frontend/panel.tsx`: issue panel content.
- `src/resolvers/index.ts`: project lookup, Jira admin permission check, and
  dynamic module API calls.
- `src/resolvers/index.test.ts`: resolver-boundary tests with mocked Forge
  requests.
- `src/index.ts`: Forge function handler export.
- `docs/`: tutorial, how-to, explanation, and module reference.
- `specs/spec.md`: original app specification; excluded from some lint checks.

The [module reference](docs/reference/reference.md) identifies the Forge
extension points; the [explanation](docs/explanation/explanation.md) covers
the visibility model. Display conditions are not an authorization boundary:
keep explicit permission checks when making app-level requests or handling
sensitive data.

[fence-rider]: https://github.com/ibuchanan/ranch-rig-fence-rider
[installation]: https://github.com/ibuchanan/ranch-rig-fence-rider/blob/main/docs/how-to/installation.md
[forge-setup]: https://developer.atlassian.com/platform/forge/getting-started/
[providers]: https://github.com/ibuchanan/ranch-rig-fence-rider/blob/main/docs/how-to/configure-user-providers.md
[app-secrets]: https://github.com/ibuchanan/ranch-rig-fence-rider/blob/main/docs/how-to/configure-app-secrets.md
[local]: https://github.com/ibuchanan/ranch-rig-fence-rider/blob/main/docs/how-to/local.md
[manifest]: https://github.com/ibuchanan/ranch-rig-fence-rider/blob/main/docs/how-to/manifest.md
[runtime]: https://github.com/ibuchanan/ranch-rig-fence-rider/blob/main/docs/how-to/runtime.md
[forge-tooling]: https://github.com/ibuchanan/ranch-rig-fence-rider/blob/main/docs/how-to/use-forge-tooling.md
