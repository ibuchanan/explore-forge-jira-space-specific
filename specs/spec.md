# Example of a Jira space-scoped Forge App

Natively, Forge is site-scoped.
That means when a Forge app contributes UI to Jira,
everyone in every Jira spaces sees the UI.
The purpose of this example is to show how to "scope down"
the app to only show in a set of allowlisted spaces.

For the purpose of this example,
we have a frontend-only UI with trivial content
surfacing in an [issue panel](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/).
We combine that with [dynamic modules API](https://developer.atlassian.com/platform/forge/apis-reference/dynamic-modules-api/)
so that we can show/hide the panel based on configuration.
The configuration UI is provided by
[Jira admin page](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-admin-page/).

## Configuration

The app's starting state is that no Jira spaces are selected.
The admin can [select](https://developer.atlassian.com/platform/forge/ui-kit/components/select/) Jira spaces.
Each one that is selected is added to a list.
The admin can remove spaces from the list.
When the admin "Applies" the list,
then the app updates the [display conditions](https://developer.atlassian.com/platform/forge/manifest-reference/display-conditions/)
with the select spaces (using the `projectKey`)
so that the panel only shows on Jira spaces that are selected.

## Issue Panel

Given the display conditions already show/hide the panel,
the panel's job is only to demonstrate the principle.
It should be frontend-only.
It simply displays a message "peek-a-boo".
