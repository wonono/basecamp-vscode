# Basecamp for VSCode

> **Note:** This is an unofficial, community-built extension. It is not affiliated with, endorsed by, or supported by Basecamp or 37signals.

Access your Basecamp projects, Campfire chats, messages, and to-dos directly inside Visual Studio Code.

## Features

- **Projects sidebar** — Browse all your Basecamp projects from the activity bar, with pinned projects at the top
- **Campfire chat** — Read and send messages in real-time with automatic polling and desktop notifications
- **Messages** — Read message threads, post comments, and create new messages
- **To-dos** — Create to-dos with notes, assignees and due dates, check off items, and comment on tasks
- **Search** — Search across all your Basecamp projects
- **Open in Basecamp** — Quickly jump to any item in the web app
- **Status bar** — See your Basecamp connection status at a glance

## Getting started

1. Install the extension
2. Click the Basecamp icon in the activity bar
3. Click **Sign In** — you'll be redirected to Basecamp to authorize the extension
4. Once authenticated, your projects appear in the sidebar

## Usage

### Projects

Click the Basecamp icon in the activity bar to see your projects. Pinned projects appear at the top. Expand a project to access its Campfire, Message Board, and To-do Sets.

### Campfire

Click on a Campfire to open the chat panel. Messages update automatically. Type a message and press **Enter** to send (Shift+Enter for a new line). You'll receive desktop notifications for new messages when the panel is not visible.

### Messages

Click on a message to read the full thread with comments. Use the **+** icon on the Message Board to create a new message.

### To-dos

Click on a to-do list to see all items. Create new to-dos with optional notes, assignees, and due dates. Click on a to-do title to view and post comments. Use the **+** icon on the To-dos dock to quickly add a to-do.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+B` (Mac) / `Ctrl+Shift+B` (Win/Linux) | Open Basecamp sidebar |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `basecamp.pollingInterval` | `15` | Polling interval in seconds for Campfire chat (minimum: 5) |

## Privacy

This extension communicates directly with the Basecamp API using OAuth 2. Your credentials are stored securely in VSCode's built-in secret storage. No data is sent to any third party.

## License

MIT
