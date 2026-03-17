# Basecamp for VSCode

> **Unofficial** — not affiliated with, endorsed by, or supported by Basecamp or 37signals.

A VSCode extension and MCP server that brings Basecamp directly into your development workflow.

## What's in the box

| Package | Description |
|---------|-------------|
| [`packages/extension`](packages/extension/) | VSCode extension — projects sidebar, Campfire chat, messages, to-dos |
| [`packages/mcp-server`](packages/mcp-server/) | MCP server — lets Claude Code (and other MCP clients) interact with Basecamp |

## Quick start

### VSCode Extension

Install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=Wonono.basecamp-vscode), click the Basecamp icon in the activity bar, and sign in.

### MCP Server

```bash
cd packages/mcp-server && npm install && npm run build
```

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "basecamp": {
      "command": "node",
      "args": ["./packages/mcp-server/build/index.js"],
      "env": {
        "BASECAMP_ACCESS_TOKEN": "<your-token>",
        "BASECAMP_ACCOUNT_ID": "<your-account-id>"
      }
    }
  }
}
```

## Development

```bash
# Install all dependencies
npm install

# Build everything
cd packages/mcp-server && npm run build
cd packages/extension && npm run compile

# Package the extension
cd packages/extension && npx @vscode/vsce package --no-dependencies

# Test in VSCode
code --install-extension packages/extension/basecamp-vscode-*.vsix --force
# Then Reload Window in VSCode
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
