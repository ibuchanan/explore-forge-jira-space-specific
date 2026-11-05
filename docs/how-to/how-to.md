# Show the issue panel only to people who can transition issues

Extend the existing project-scoped panel so a Jira administrator can also
require the viewer to have the `TRANSITION_ISSUES` permission on the issue. The
admin setting updates the **dynamic** `jira:issuePanel`; it does not add a
static module to `manifest.yml`. Start from the working app in the
[tutorial](../tutorials/tutorial.md).

> The [Jira display-conditions reference](https://developer.atlassian.com/platform/forge/manifest-reference/display-conditions/jira/)
> lists the supported `hasIssuePermission` values. Display conditions govern
> visibility, **not authorization**. Check permissions again in any resolver
> that reads or changes sensitive data.
1. In `src/resolvers/index.ts`, extend `Panel`'s `displayConditions` type to
   include `hasIssuePermission?: string` alongside `projectKey`. Add a
   `transitionOnly: boolean` field to the configuration returned by both
   `getConfig` and `loadAdmin`. Read it from the dynamic panel so the admin page
   retains the setting after a refresh:

   ```ts
   transitionOnly:
     panel?.data.displayConditions?.hasIssuePermission === "TRANSITION_ISSUES"
   ```

   In `loadAdmin`, use `panel.value` instead of `panel` in this expression. For
   an absent panel, the result is `false`. Keep the existing `projectKeys`
   result unchanged.

2. Extend the `applyConfig` payload with `transitionOnly: boolean` and reject
   values other than `true` or `false` with the existing typed 400 response.
   Retain the Jira administrator check and the validation of project keys.
   For a nonempty project list, construct the dynamic module's data with:

   ```ts
   displayConditions: {
     projectKey: payload.projectKeys,
     ...(payload.transitionOnly && {
       hasIssuePermission: "TRANSITION_ISSUES",
     }),
   },
   ```

   This adds the permission condition **and** the existing project condition;
   both must match. When the setting is off, omit `hasIssuePermission` so the
   panel remains visible in selected projects as before. The existing empty
   project-list path still deletes the module. Return `transitionOnly` along
   with `projectKeys` after applying, and update the resolver's payload type.
   Do not derive the configured flag from the current viewer's permissions.

3. In `src/frontend/index.tsx`, add `transitionOnly` to `Config` and initialize
   a boolean state field from `loadAdmin`. Add an admin control labeled
   **Require permission to transition issues**. Send its current value with
   `projectKeys` in the existing `invoke("applyConfig", ...)` call. Keep the
   **Apply** button as the commit point: changing the control alone must not
   update the dynamic module. Initialize it to `false` when no panel exists.

4. Extend `src/resolvers/index.test.ts` at the resolver boundary. Cover an
   existing panel with `hasIssuePermission: "TRANSITION_ISSUES"` loading as
   `transitionOnly: true`, a missing condition loading as `false`, applying
   `true` producing both conditions in the POST/PUT body, and applying `false`
   omitting `hasIssuePermission`. Verify invalid boolean payloads return a
   typed 400 without changing the module. Run `npm run check`.

5. Deploy the changed app to an authorized development site and upgrade its
   installation **if** the manifest gains scopes. This change does not itself
   require a new scope. In **Apps → Peek-a-boo spaces**, select a project,
   enable **Require permission to transition issues**, and select **Apply**.
   Test the same issue in Jira's new issue view with two accounts that can
   **both edit the issue**, but only one has `TRANSITION_ISSUES`. The
   **Peek-a-boo** button should be offered only to the account with that
   permission. Disable the setting, apply again, and refresh: both accounts
   should see the button in the selected project. The
   [`jira:issuePanel` button also requires issue-edit permission](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/),
   so a viewer lacking that permission cannot isolate the effect of this
   display condition.
