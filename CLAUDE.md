# Basecamp VSCode Extension

## Project structure

Monorepo with npm workspaces:
- `packages/extension/` — VSCode extension (TypeScript, esbuild)
- `packages/mcp-server/` — Basecamp MCP server (TypeScript)

## Extension dev workflow

After any code change in the extension, always run the full rebuild + reinstall cycle:

```bash
cd /Users/wonono/basecamp-vscode/packages/extension && \
  rm -f basecamp-vscode-*.vsix && \
  npx @vscode/vsce package --no-dependencies 2>&1 && \
  "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
    --install-extension basecamp-vscode-*.vsix --force
```

Then remind the user to **Reload Window** (Ctrl+Shift+P → "Reload Window") — this cannot be automated from the terminal.

**Important**: Always use `--no-dependencies` when packaging — the monorepo workspace causes vsce to include parent directory files otherwise.

## OAuth credentials (Basecamp Launchpad)

- Client ID: `beaa3634395a922cc1e8a7fa290a12c72171e479`
- Redirect URI: `http://localhost:21437/callback`
- Publisher: Wonono

## Key conventions

- Extension bundled with esbuild (see `esbuild.js`)
- Activity bar icon: `resources/basecamp-icon.svg` (official Basecamp logo from SimpleIcons)
- Webview assets in `webview/` (campfire, message, todo, shared)
