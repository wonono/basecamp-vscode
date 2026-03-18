---
name: bump-extension
description: Bump the version of the Basecamp VSCode extension and recompile the VSIX. Use this skill whenever the user wants to release a new version, bump the version, build or package the extension, or says things like "release", "ship", "build the vsix", "bump the version", "nouvelle version", "release extension". Evaluates git changes since the last version bump to suggest a coherent semantic version increment (patch/minor/major), then runs the full rebuild + reinstall cycle.
---

# Bump Extension Version

Analyze the changes since the last version bump, propose the right semver increment, update `package.json`, and build a fresh VSIX — all in one workflow.

## Step 1 — Read the current version

```bash
node -p "require('./packages/extension/package.json').version"
```

## Step 2 — Find what changed since the last version bump

Find the commit that last bumped the version (look for commits whose message contains "bump version" or "version X.Y.Z"):

```bash
git log --oneline | grep -iE "bump version|version [0-9]+\.[0-9]+\.[0-9]+" | head -3
```

Once you have the hash of the last version-bump commit, list everything that changed since then:

```bash
git log --oneline <last-bump-hash>..HEAD
git diff --stat <last-bump-hash>..HEAD -- packages/extension/ packages/mcp-server/
```

If there are no commits since the last bump, tell the user and ask whether they still want to rebuild.

## Step 3 — Suggest the version bump level

Use the commit messages and changed files to determine the right semver level:

| Signal | Level |
|--------|-------|
| "feat", "add", "new", "implement", new command/panel/feature | **minor** (0.x.0) |
| "fix", "refactor", "update", "improve", "tweak", dependency update, UI polish | **patch** (0.0.x) |
| Breaking API change, removed feature, incompatible config change | **major** (x.0.0) |

When multiple signals are present, take the highest applicable level. When in doubt between minor and patch, prefer minor — it's better to over-signal new capability than under-signal it.

Present your analysis to the user:

> "Since v0.3.3 there are 4 commits:
> - feat: new search panel → new feature
> - fix: auth token refresh → bug fix
>
> Suggested bump: **minor** → v0.4.0
> Does that look right, or do you want patch/major instead?"

Wait for confirmation before proceeding.

## Step 4 — Compute and apply the new version

Increment the version based on the confirmed bump level:

```
current: X.Y.Z
patch:   X.Y.(Z+1)
minor:   X.(Y+1).0
major:   (X+1).0.0
```

Update the `version` field in `packages/extension/package.json` using the Edit tool (not `npm version` — the monorepo setup can cause issues).

Also check whether `packages/mcp-server/` has changed since the last bump. If it has, bump its version in `packages/mcp-server/package.json` to match.

## Step 5 — Rebuild the MCP server (only if it changed)

If `packages/mcp-server/` files were modified since the last bump:

```bash
cd /Users/wonono/basecamp-vscode/packages/mcp-server && npm run build
```

Skip this step if only the extension changed — rebuilding an unchanged MCP server is unnecessary.

## Step 6 — Build the VSIX

Run the full rebuild + reinstall cycle from the extension directory. Always use `--no-dependencies` — the monorepo workspace causes vsce to pull in parent-directory files otherwise:

```bash
cd /Users/wonono/basecamp-vscode/packages/extension && \
  rm -f basecamp-vscode-*.vsix && \
  npx @vscode/vsce package --no-dependencies 2>&1 && \
  "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
    --install-extension basecamp-vscode-*.vsix --force
```

If the build fails, show the full error output and stop — don't commit the version bump until the build succeeds.

## Step 7 — Commit the version bump

Once the VSIX builds successfully:

```bash
git add packages/extension/package.json
# also add mcp-server/package.json if it was bumped
git commit -m "Bump version to X.Y.Z"
```

## Step 8 — Wrap up

Tell the user:

> "Version bumped to **X.Y.Z** and VSIX installed locally.
>
> Please **Reload Window** (Ctrl+Shift+P → 'Reload Window') to activate the new version.
>
> To publish: drag & drop `basecamp-vscode-X.Y.Z.vsix` onto https://marketplace.visualstudio.com/manage → '...' → **Update**"

## Constraints

- Never bump the version without confirming with the user first
- Always build successfully before committing the version bump
- Always use `--no-dependencies` when running `vsce package`
- If the user specifies a level explicitly (e.g. "bump minor"), skip the analysis and use their requested level directly
- Communicate with the user in their language (French/English/etc.); keep commit messages in English
