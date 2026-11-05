<!-- cspell:ignore specifc ibuchanan -->

# Explore Jira Space-specifc Apps

[![Atlassian license](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

A Forge example app that shows an issue panel only in Jira projects selected
by a site administrator. It combines a Jira display condition with a
dynamically registered issue panel, so the administrator can change where the
panel appears without redeploying the app. The panel displays `peek-a-boo`.

## Try it

You'll need a Jira site with two projects and test issues, Jira administrator
access, and an authenticated
[Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/).
[Configure the local Forge target](DEVELOPMENT.md#first-time-forge-setup-with-fence-rider)
before running the commands below. Deploy and install only to an app and site
you are authorized to change; register this copy first **only if** it needs
its own app identity.

```sh
npm install
npm run forge:deploy
npm run forge:install
```

In Jira, open **Apps → Peek-a-boo spaces**, add a project, and select
**Apply**. On an issue in that project (in the new issue view), open
**Peek-a-boo** from the issue panel menu to see `peek-a-boo`. The button is not
offered on issues in unselected projects. Issue-panel buttons require
issue-edit permission; an empty applied list hides the panel everywhere.
Follow the [guided tutorial](docs/tutorials/tutorial.md) to move the panel
between projects and clear the list.

## Documentation

- [Tutorial](docs/tutorials/tutorial.md): register when needed, deploy,
  install, and see the panel in action.
- [How-to](docs/how-to/how-to.md): extend the example with a viewer-permission
  condition (not implemented in this app).
- [Explanation](docs/explanation/explanation.md): why dynamic modules and
  display conditions work together.
- [Reference](docs/reference/reference.md): Forge modules and resources used
  here.
- [Development](DEVELOPMENT.md): setup, local checks, source layout, and
  deployment workflow.

Display conditions control visibility, **not authorization**. Check access
in code before handling sensitive data; the app checks Jira administrator
permission before changing its dynamic panel.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process and
[SECURITY.md](SECURITY.md) for reporting security concerns. Owned by
`ibuchanan` ([repository ownership metadata](.atlassian/OWNER)).
Copyright (c) 2026 Atlassian US., Inc. Licensed under [Apache 2.0](LICENSE).
