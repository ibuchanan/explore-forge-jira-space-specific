# See the project-scoped issue panel in Jira

In this exercise, you will deploy the app to a development Jira site, select
one project in its admin page, and compare issues in two projects. Use a site
and app registration you are authorized to change: the deployment and
installation commands below modify remote state.

Before starting, have two Jira projects with issues you can open, Jira
administrator access to configure the app, and permission to edit the test
issue so Jira can show its issue-panel button. Install and authenticate the
[Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/),
then configure the local `FORGE_SITE`, `FORGE_PRODUCT` (`jira`), and
`FORGE_ENVIRONMENT` (`development`) values described in
[DEVELOPMENT.md](../../DEVELOPMENT.md#first-time-forge-setup-with-fence-rider).
This repository's `forge:*` scripts use Fence Rider and SecretSpec to resolve
those values; do not put credentials in source files.
1. From the repository root, install dependencies and check the required
   tools and local configuration:

   ```sh
   npm install
   bun run fence-rider doctor
   SECRETSPEC_PROFILE=default bun run fence-rider doctor --resolve
   ```

   Resolve any missing tool or configuration reported by the doctor before
   continuing. Do not print resolved secret values.

2. Check `manifest.yml` for an `app.id`. This repository already contains
   one. **If you own or are authorized to use that registration, do not run
   `forge register` again.** If you are using a copy that must have its own
   app registration, run `npm run forge:register` **once** instead. It replaces
   `app.id` with a new registration and disconnects this copy from any prior
   app environments, variables, and storage.

3. Deploy and install the development app on the configured Jira site:

   ```sh
   npm run forge:deploy
   npm run forge:install
   ```

   These scripts use your configured target. The current `secretspec.toml`
   declares no runtime variables to upload, so `forge:variables:set` is not
   needed for this exercise. After installation, the panel is absent because
   no projects have been selected yet.

4. In Jira administration, open **Apps → Peek-a-boo spaces**. Choose one
   project in **Add a Jira space**, select **Add**, then **Apply**. Wait for
   **Project list applied.** Adding to the list alone does not change the
   installed panel; applying does.

5. Open an issue in the selected project in Jira's new issue view. Open the
   **Peek-a-boo** issue panel from the issue view's app/button menu. Its content
   reads `peek-a-boo`. Open an issue in the other project: the panel's button
   should not be offered there.

6. Return to **Apps → Peek-a-boo spaces**. Select **Remove** beside the first
   project, add the other project, and select **Apply**. Wait for **Project list
   applied.** Refresh both issues: the panel's button should now be offered
   only in the newly selected project. Open that panel to see `peek-a-boo`.

7. Return to the admin page, select **Remove** beside the remaining project,
   and select **Apply**. Wait for **Project list applied.** Refresh both issues:
   neither should offer the panel's button. The list is empty again, just as
   it was before you first configured the app.

You have now seen a single installed app expose its panel in one project,
move it to another, and hide it everywhere without redeploying. For the
underlying mechanism, read the [explanation](../explanation/explanation.md);
for the module wiring, consult the [reference](../reference/reference.md).
