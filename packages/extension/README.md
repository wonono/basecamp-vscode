# Basecamp for VSCode

> **Note:** This is an unofficial, community-built extension. It is not affiliated with, endorsed by, or supported by Basecamp or 37signals.

Access your Basecamp projects, Campfire chats, messages, and to-dos directly inside Visual Studio Code.

## Features

- **Projects sidebar** — Browse all your Basecamp projects from the activity bar
- **Campfire chat** — Read and send messages in real-time with automatic polling
- **Messages** — Read message threads and post comments
- **To-dos** — View to-do lists and check off items

## Getting started

1. Install the extension
2. Click the Basecamp icon in the activity bar
3. Click **Sign In** — you'll be redirected to Basecamp to authorize the extension
4. Once authenticated, your projects appear in the sidebar

## Usage

### Projects

Click the Basecamp icon in the activity bar to see your projects. Expand a project to access its Campfires, Message Board, and To-do Sets.

### Campfire

Click on a Campfire to open the chat panel. Messages update automatically. Type a message and press **Enter** to send (Shift+Enter for a new line).

### Messages

Click on a message to read the full thread with comments. You can post comments directly from the panel.

### To-dos

Click on a to-do list to see all items. Check off to-dos as you complete them.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `basecamp.pollingInterval` | `15` | Polling interval in seconds for Campfire chat (minimum: 5) |

## Privacy

This extension communicates directly with the Basecamp API using OAuth 2. Your credentials are stored securely in VSCode's built-in secret storage. No data is sent to any third party.

## License

MIT
