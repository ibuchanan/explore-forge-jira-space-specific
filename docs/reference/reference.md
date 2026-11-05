# Forge modules and resources

The app's extension points are declared in `manifest.yml`, except for the
issue panel, which is registered per installation through the
[Forge Dynamic Modules API](https://developer.atlassian.com/platform/forge/apis-reference/dynamic-modules/).

| Module                                                                                                           | Declaration                                  | Key or resource                            | Role                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| [`jira:adminPage`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-admin-page/)   | Static (`manifest.yml`)                      | `space-allowlist-admin`; resource `main`   | Jira administration UI for selecting project keys and applying the list.      |
| [`function`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/function/)                | Static (`manifest.yml`)                      | `config-resolver`; handler `index.handler` | Resolver for loading project choices and changing the issue panel.            |
| [`jira:issuePanel`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/) | Dynamic, created or updated by `applyConfig` | Resource `panel`; title `Peek-a-boo`       | Issue-view panel showing `peek-a-boo`; absent when the applied list is empty. |

| [Resource](https://developer.atlassian.com/platform/forge/manifest-reference/resources/) | Path                     | Consumer                                |
| ---------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------- |
| `main`                                                                                   | `src/frontend/index.tsx` | Static admin page (`render: native`).   |
| `panel`                                                                                  | `src/frontend/panel.tsx` | Dynamic issue panel (`render: native`). |

The dynamic panel uses
[`displayConditions.projectKey`](https://developer.atlassian.com/platform/forge/manifest-reference/display-conditions/jira/)
with the applied array of Jira project keys. The `read:jira-work` scope in
`manifest.yml` covers the Jira project search and permission-check requests.
