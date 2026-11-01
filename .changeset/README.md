# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) for managing versioning and changelogs across packages in the Shard.js monorepo.

## Adding a changeset

To create a new changeset for your contribution:

```bash
pnpm changeset
```

Follow the interactive prompts to select the packages that have changed, whether the bump is `major`, `minor`, or `patch`, and provide a summary of the change.
