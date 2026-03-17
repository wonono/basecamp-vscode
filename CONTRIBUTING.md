# Contributing

Thanks for your interest in contributing to Basecamp for VSCode!

## Getting started

1. Fork and clone the repo
2. `npm install` at the root
3. Build the MCP server: `cd packages/mcp-server && npm run build`
4. Build the extension: `cd packages/extension && npm run compile`
5. Press **F5** in VSCode to launch the Extension Development Host

## Project structure

```
packages/
  extension/     VSCode extension (TypeScript, esbuild)
    src/           Extension source code
    webview/       HTML/CSS/JS for webview panels (campfire, message, todo)
    resources/     Icons
  mcp-server/    Basecamp MCP server (TypeScript)
    src/           Server source code
```

## Making changes

### Extension

1. Edit code in `packages/extension/src/` or `packages/extension/webview/`
2. Press **F5** to test in the Extension Development Host
3. Or package and install manually:
   ```bash
   cd packages/extension
   npx @vscode/vsce package --no-dependencies
   code --install-extension basecamp-vscode-*.vsix --force
   ```

### MCP Server

1. Edit code in `packages/mcp-server/src/`
2. `npm run build` to compile
3. Restart your MCP client to pick up changes

## Guidelines

- Keep it simple — avoid over-engineering
- Test your changes manually before submitting a PR
- One feature or fix per PR
- Follow the existing code style (TypeScript strict, no semicolons in webview JS)

## Reporting issues

Open an issue on GitHub with:
- What you expected
- What happened instead
- Steps to reproduce

## OAuth credentials

The OAuth Client ID and Secret are hardcoded in the extension. This is intentional — Basecamp desktop OAuth apps use public credentials (same model as mobile apps). Do not replace them with your own unless you're running a private fork.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
