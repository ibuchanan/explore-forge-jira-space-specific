# Why this app combines display conditions and dynamic modules

A Forge app is installed on a Jira site, but the example issue panel should
appear only in selected Jira spaces (projects). Those are different concerns:
installation determines where the app is available, while a
[display condition](https://developer.atlassian.com/platform/forge/manifest-reference/display-conditions/)
determines whether a particular module is shown in a given context. For an
issue panel, Jira's
[`projectKey` condition](https://developer.atlassian.com/platform/forge/manifest-reference/display-conditions/jira/)
can match the current issue's project against an array of allowed keys.

A condition on a _static_ `jira:issuePanel` in `manifest.yml` would narrow its
visibility, but its allowed keys would be part of the deployed app. Changing
them would require a manifest change and another deployment. Forge's
[dynamic modules](https://developer.atlassian.com/platform/forge/apis-reference/dynamic-modules/)
let an app register, update, or delete supported modules for each installation.
That makes the condition configurable through a Jira admin page instead.

This app keeps the `jira:adminPage` and its resolver in the manifest, along
with a `panel` UI Kit resource. It does **not** declare a static issue panel.
When an administrator applies a nonempty list of project keys, the resolver
registers or updates one dynamic `jira:issuePanel` with
`displayConditions.projectKey` set to that list. When the list is empty, it
deletes that panel. With no dynamic panel registered, a fresh installation
shows no panel anywhere. The panel resource itself only renders `peek-a-boo`;
Forge decides where the module is visible before that frontend runs.

Display conditions are a **visibility mechanism, not an authorization
boundary**: Forge notes that their client-side evaluation can be overridden.
This example's resolver separately checks the caller's Jira administrator
permission before changing the dynamic module. An app handling sensitive data
would also need appropriate access checks in its own code; hiding a panel alone
would not protect that data.
