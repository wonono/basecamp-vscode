# Basecamp VSCode Extension — Implementation Spec

## Goals

1. **All-in-one workspace** — Basecamp directly in VSCode: projects, campfire chats, to-dos, message boards — no browser switching
2. **Claude Code integration** — Reference Basecamp discussions, to-dos, and messages so Claude can read them and provide expertise without copy/pasting

## Repository

Public GitHub repo, monorepo with two packages:

```
basecamp-vscode/
├── packages/
│   ├── extension/          # VSCode extension
│   └── mcp-server/         # MCP server for Claude Code
├── package.json            # Workspace root
├── LICENSE                 # MIT
└── README.md
```

---

# Part 1 — Basecamp API Reference

## Authentication

- **OAuth 2.0** — Authorization code grant, the only option (no API keys, no Basic auth)
- Register app at [Basecamp Launchpad](https://launchpad.37signals.com/integrations)
- Redirect URI supports `http://localhost` for desktop apps
- Refresh tokens for long-lived sessions

### Required Headers

```
Authorization: Bearer {ACCESS_TOKEN}
User-Agent: BasecampVSCode (contact@example.com)   # REQUIRED — 400 without it
Content-Type: application/json; charset=utf-8        # For POST/PUT — 415 without it
```

### HTTP Caching

Responses include `ETag` / `Last-Modified`. Send `If-None-Match` / `If-Modified-Since` to get `304 Not Modified`. Use this to reduce bandwidth on polling.

## Base URL

```
https://3.basecampapi.com/{account_id}/
```

All endpoints return JSON, all URLs end in `.json`, HTTPS only.

## Pagination

- "Geared pagination": page 1 = 15 results, page 2 = 30, page 3 = 50, page 4+ = 100
- `Link` header (RFC 5988): `Link: <...?page=4>; rel="next"`
- `X-Total-Count` header: total number of resources
- Empty `Link` header = last page
- Never construct pagination URLs manually — always follow the `Link` header

## Rate Limiting

- ~50 requests per 10-second window per IP (multiple overlapping limits for GET vs POST, per-second/hour/day)
- Returns `429 Too Many Requests` with `Retry-After` header
- 5xx errors: retry with exponential backoff
- 404: do not retry (may include `Reason: Account Inactive` header)

---

## Endpoints & Response Shapes

### Projects

**List all projects:** `GET /projects.json`
- Optional: `?status=archived` or `?status=trashed`

```json
[
  {
    "id": 2085958504,
    "status": "active",
    "created_at": "2025-12-29T18:52:00.000Z",
    "updated_at": "2026-02-26T16:42:05.843Z",
    "name": "The Leto Laptop",
    "description": "Laptop product launch.",
    "purpose": "topic",
    "clients_enabled": false,
    "timesheet_enabled": true,
    "color": null,
    "bookmark_url": "https://3.basecampapi.com/195539477/my/bookmarks/BAh7...json",
    "url": "https://3.basecampapi.com/195539477/projects/2085958504.json",
    "app_url": "https://3.basecamp.com/195539477/projects/2085958504",
    "dock": [
      {
        "id": 1069479392,
        "title": "Message Board",
        "name": "message_board",
        "enabled": true,
        "position": 1,
        "url": "https://3.basecampapi.com/.../message_boards/1069479392.json",
        "app_url": "https://3.basecamp.com/.../message_boards/1069479392"
      },
      {
        "id": 1069479393,
        "title": "To-dos",
        "name": "todoset",
        "enabled": true,
        "position": 2,
        "url": "...",
        "app_url": "..."
      },
      {
        "id": 1069479394,
        "title": "Docs & Files",
        "name": "vault",
        "enabled": true,
        "position": 3,
        "url": "...",
        "app_url": "..."
      },
      {
        "id": 1069479395,
        "title": "Chat",
        "name": "chat",
        "enabled": true,
        "position": 4,
        "url": "...",
        "app_url": "..."
      },
      {
        "id": 1069479396,
        "title": "Schedule",
        "name": "schedule",
        "enabled": true,
        "position": 5,
        "url": "...",
        "app_url": "..."
      },
      { "id": 1069479397, "title": "Automatic Check-ins", "name": "questionnaire", "enabled": false, "position": null },
      { "id": 1069479398, "title": "Email Forwards", "name": "inbox", "enabled": false, "position": null },
      { "id": 1069479399, "title": "Card Table", "name": "kanban_board", "enabled": false, "position": null }
    ],
    "bookmarked": false
  }
]
```

**Get single project:** `GET /projects/{id}.json` — Same shape (single object).

**Create project:** `POST /projects.json` — Required: `name`. Optional: `description`. Returns `201`.

### Campfires (Chat)

**List all campfires:** `GET /chats.json` — Paginated.

```json
[
  {
    "id": 1069478985,
    "status": "active",
    "visible_to_clients": false,
    "created_at": "2026-03-09T18:59:59.152Z",
    "updated_at": "2026-03-09T19:00:08.022Z",
    "title": "Chat",
    "inherits_status": true,
    "type": "Chat::Transcript",
    "url": "https://3.basecampapi.com/.../chats/1069478985.json",
    "app_url": "https://3.basecamp.com/.../chats/1069478985",
    "bookmark_url": "...",
    "subscription_url": "...",
    "position": 4,
    "bucket": {
      "id": 2085958502,
      "name": "Honcho Design Newsroom",
      "type": "Project"
    },
    "creator": {
      "id": 1049715913,
      "name": "Victor Cooper",
      "email_address": "victor@honchodesign.com",
      "personable_type": "User",
      "title": "Chief Strategist",
      "avatar_url": "...",
      "company": { "id": 1033447817, "name": "Honcho Design" }
    },
    "topic": "Chat",
    "lines_url": "https://3.basecampapi.com/.../chats/1069478985/lines.json"
  }
]
```

**Get campfire lines:** `GET /chats/{id}/lines.json` — Paginated.

```json
[
  {
    "id": 1069479068,
    "status": "active",
    "visible_to_clients": false,
    "created_at": "2025-12-14T04:10:00.000Z",
    "updated_at": "2025-12-14T04:10:00.000Z",
    "title": "I'm hungry",
    "inherits_status": true,
    "type": "Chat::Lines::RichText",
    "url": "https://3.basecampapi.com/.../chats/1069478985/lines/1069479068.json",
    "app_url": "https://3.basecamp.com/.../chats/1069478985@1069479068",
    "boosts_count": 0,
    "parent": {
      "id": 1069478985,
      "title": "Chat",
      "type": "Chat::Transcript",
      "url": "...",
      "app_url": "..."
    },
    "bucket": { "id": 2085958502, "name": "Honcho Design Newsroom", "type": "Project" },
    "creator": { "id": 1049715913, "name": "Victor Cooper", "avatar_url": "..." },
    "content": "I'm hungry"
  }
]
```

**Post campfire line:** `POST /chats/{id}/lines.json`
- Body: `{"content": "Good morning"}` — plain text only
- Returns `201`

**Delete campfire line:** `DELETE /chats/{chat_id}/lines/{line_id}.json` — Returns `204`.

### Messages

**List messages:** `GET /message_boards/{id}/messages.json` — Paginated.

```json
[
  {
    "id": 1069479583,
    "status": "active",
    "visible_to_clients": false,
    "created_at": "2026-01-29T23:40:00.000Z",
    "updated_at": "2026-02-12T06:13:58.024Z",
    "title": "Laptop high res glamour shots",
    "inherits_status": true,
    "type": "Message",
    "url": "...",
    "app_url": "...",
    "comments_count": 1,
    "comments_url": "https://3.basecampapi.com/.../recordings/1069479583/comments.json",
    "parent": {
      "id": 1069479392,
      "title": "Message Board",
      "type": "Message::Board"
    },
    "bucket": { "id": 2085958504, "name": "The Leto Laptop", "type": "Project" },
    "creator": { "id": 1049715913, "name": "Victor Cooper" },
    "content": "<div><strong>HTML content</strong> with rich text</div>",
    "subject": "Laptop high res glamour shots"
  }
]
```

**Create message:** `POST /message_boards/{id}/messages.json`
- Required: `subject` (string), `status` (`"active"` to publish)
- Optional: `content` (HTML string), `category_id`, `subscriptions` (array of person IDs)
- Returns `201`

**Update message:** `PUT /messages/{id}.json` — Optional: `subject`, `content`, `category_id`.

### Message Boards

**Get message board:** `GET /message_boards/{id}.json`

```json
{
  "id": 1069479392,
  "status": "active",
  "title": "Message Board",
  "type": "Message::Board",
  "messages_count": 9,
  "messages_url": "https://3.basecampapi.com/.../message_boards/1069479392/messages.json",
  "bucket": { "id": 2085958504, "name": "The Leto Laptop", "type": "Project" },
  "creator": { "id": 1049715913, "name": "Victor Cooper" }
}
```

The message board ID is found in the project's `dock` array (name: `"message_board"`).

### To-do Lists

**List to-do lists:** `GET /todosets/{id}/todolists.json` — Paginated.

```json
[
  {
    "id": 1069479573,
    "status": "active",
    "title": "Strategy ideas",
    "type": "Todolist",
    "parent": { "id": 1069479393, "title": "To-dos", "type": "Todoset" },
    "bucket": { "id": 2085958504, "name": "The Leto Laptop", "type": "Project" },
    "creator": { "id": 1049715913, "name": "Victor Cooper" },
    "description": "",
    "completed": false,
    "completed_ratio": "2/5",
    "name": "Strategy ideas",
    "todos_url": "https://3.basecampapi.com/.../todolists/1069479573/todos.json",
    "comments_count": 0
  }
]
```

**Create to-do list:** `POST /todosets/{id}/todolists.json`
- Required: `name`. Optional: `description` (HTML). Returns `201`.

### To-dos

**List to-dos:** `GET /todolists/{id}/todos.json`
- Optional: `?status=archived|trashed`, `?completed=true`
- Paginated.

```json
[
  {
    "id": 1069479574,
    "status": "active",
    "title": "Go cutting edge: iOS8 and Android 4.5 only",
    "type": "Todo",
    "position": 1,
    "parent": { "id": 1069479573, "title": "Strategy ideas", "type": "Todolist" },
    "bucket": { "id": 2085958504, "name": "The Leto Laptop", "type": "Project" },
    "creator": { "id": 1049715913, "name": "Victor Cooper" },
    "description": "",
    "completed": false,
    "content": "Go cutting edge: iOS8 and Android 4.5 only",
    "starts_on": null,
    "due_on": null,
    "assignees": [],
    "completion_subscribers": [],
    "completion_url": "https://3.basecampapi.com/.../todos/1069479574/completion.json",
    "comments_count": 0,
    "comments_url": "..."
  }
]
```

**Create to-do:** `POST /todolists/{id}/todos.json`
- Required: `content`
- Optional: `description` (HTML), `assignee_ids` (int[]), `due_on` (date), `starts_on` (date), `notify` (bool)
- Returns `201`

**Update to-do:** `PUT /todos/{id}.json`
- Required: `content` (always required to preserve value)
- IMPORTANT: Pass ALL existing parameters — omitting a parameter clears its value

**Complete:** `POST /todos/{id}/completion.json` — Returns `204`.
**Uncomplete:** `DELETE /todos/{id}/completion.json` — Returns `204`.

### Comments

**List comments:** `GET /recordings/{id}/comments.json` — Paginated.

```json
[
  {
    "id": 1069479407,
    "status": "active",
    "title": "Re: We won Leto!",
    "type": "Comment",
    "parent": { "id": 1069479406, "title": "We won Leto!", "type": "Message" },
    "bucket": { "id": 2085958504, "name": "The Leto Laptop", "type": "Project" },
    "creator": { "id": 1049715913, "name": "Victor Cooper" },
    "content": "Yeah! Great job everyone! Super excited to get going!"
  }
]
```

**Create comment:** `POST /recordings/{id}/comments.json`
- Required: `content` (HTML string)
- Returns `201`. All subscribers of the recording are notified.

### People

**List all people:** `GET /people.json`

```json
[
  {
    "id": 1049715913,
    "name": "Victor Cooper",
    "email_address": "victor@honchodesign.com",
    "personable_type": "User",
    "title": "Chief Strategist",
    "bio": "Don't let your dreams be dreams",
    "location": "Chicago, IL",
    "admin": true,
    "owner": true,
    "client": false,
    "employee": true,
    "time_zone": "America/Chicago",
    "avatar_url": "https://3.basecampapi.com/.../avatar",
    "company": { "id": 1033447817, "name": "Honcho Design" },
    "can_ping": true,
    "can_manage_projects": true,
    "can_manage_people": true
  }
]
```

**Get my profile:** `GET /my/profile.json` — Single person object.
**People on a project:** `GET /projects/{id}/people.json` — Same shape.
**Pingable people:** `GET /circles/people.json` — Not paginated.

### Webhooks

**Create webhook:** `POST /buckets/{project_id}/webhooks.json`
- Required: `payload_url` (HTTPS)
- Optional: `types` (array, e.g. `["Todo", "Message"]`)
- Returns `201`

**Supported types:** Comment, Document, GoogleDocument, Inbox::Forward, Kanban::Card, Kanban::Step, Message, Question, Question::Answer, Schedule::Entry, Todo, Todolist, Upload, Vault, Client::Approval::Response, Client::Forward, Client::Reply

**NOTE: Chat (Campfire) is NOT supported via webhooks — use Chatbot API instead.**

**Webhook payload (delivered to your endpoint):**

```json
{
  "id": 9007199254741210,
  "kind": "message_created",
  "details": { "notified_recipient_ids": [1007299144] },
  "created_at": "2026-06-08T19:00:41.933Z",
  "recording": {
    "id": 9007199254741622,
    "status": "active",
    "title": "Welcome to Basecamp!",
    "type": "Message",
    "content": "<HTML>",
    "parent": { "id": "...", "title": "...", "type": "Message::Board" },
    "bucket": { "id": "...", "name": "...", "type": "Project" },
    "creator": { "id": "...", "name": "..." }
  },
  "creator": { "id": "...", "name": "..." }
}
```

### Chatbots

**Create chatbot:** `POST /chats/{chat_id}/integrations.json`
- Required: `service_name` (alphanumeric only, no spaces/emoji)
- Optional: `command_url` (HTTPS)
- Returns `201`

**Post as chatbot:** `POST /integrations/{CHATBOT_KEY}/buckets/{project_id}/chats/{chat_id}/lines.json`
- Required: `content` (string)
- Note: uses `CHATBOT_KEY` from the `lines_url` field, NOT the chatbot ID

**Interactive chatbot payload (received at `command_url`):**
```json
{
  "command": "What up?",
  "creator": { "id": 1007299143, "name": "Victor Cooper", "email_address": "..." },
  "callback_url": "https://3.basecamp.com/.../integrations/.../lines"
}
```

---

# Part 2 — VSCode Extension API Reference

## package.json Contribution Points

### viewContainers (sidebar icon)

```json
{
  "contributes": {
    "viewContainers": {
      "activitybar": [
        {
          "id": "basecamp-sidebar",
          "title": "Basecamp",
          "icon": "resources/basecamp-icon.svg"
        }
      ]
    }
  }
}
```

### views (tree in sidebar)

```json
{
  "contributes": {
    "views": {
      "basecamp-sidebar": [
        {
          "id": "basecamp-projects",
          "name": "Projects",
          "type": "tree"
        }
      ]
    }
  }
}
```

### activationEvents

Since VSCode 1.74+, `onCommand` and `onView` are auto-generated from `contributes.commands` and `contributes.views`. No need to declare them.

### commands

```json
{
  "contributes": {
    "commands": [
      {
        "command": "basecamp.refresh",
        "title": "Refresh",
        "category": "Basecamp",
        "icon": "$(refresh)"
      },
      {
        "command": "basecamp.openCampfire",
        "title": "Open Campfire",
        "category": "Basecamp"
      }
    ]
  }
}
```

### menus (toolbar buttons on tree view)

```json
{
  "contributes": {
    "menus": {
      "view/title": [
        {
          "command": "basecamp.refresh",
          "when": "view == basecamp-projects",
          "group": "navigation"
        }
      ]
    }
  }
}
```

### viewsWelcome (empty state)

```json
{
  "contributes": {
    "viewsWelcome": [
      {
        "view": "basecamp-projects",
        "contents": "Connect your Basecamp account to get started.\n[Sign In](command:basecamp.signIn)"
      }
    ]
  }
}
```

## Key TypeScript Types

### ViewBadge (unread counter on sidebar icon)

```typescript
interface ViewBadge {
  readonly tooltip: string;
  readonly value: number;  // displayed as count on the icon
}

// Usage:
treeView.badge = { value: 5, tooltip: "5 unread items" };
treeView.badge = undefined;  // clear badge
```

Works on both `TreeView<T>` and `WebviewView`.

### TreeDataProvider

```typescript
interface TreeDataProvider<T> {
  onDidChangeTreeData?: Event<T | T[] | undefined | null | void>;
  getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
  getChildren(element?: T): ProviderResult<T[]>;
  getParent?(element: T): ProviderResult<T>;  // Required for reveal()
}
```

### TreeItem

```typescript
class TreeItem {
  label?: string | TreeItemLabel;
  id?: string;
  iconPath?: string | Uri | { light: Uri; dark: Uri } | ThemeIcon;
  description?: string | boolean;
  tooltip?: string | MarkdownString;
  command?: Command;  // Executed on click (for leaf items)
  collapsibleState?: TreeItemCollapsibleState;
  contextValue?: string;  // For `when` clauses in menus
}

enum TreeItemCollapsibleState {
  None = 0,       // Leaf — click triggers command
  Collapsed = 1,  // Expandable, starts collapsed
  Expanded = 2    // Expandable, starts expanded
}
```

### Opening a WebviewPanel on TreeItem click

```typescript
// In TreeDataProvider.getTreeItem():
item.command = {
  command: 'basecamp.openCampfire',
  title: 'Open Campfire',
  arguments: [element]  // passed to the command handler
};

// In activate():
vscode.commands.registerCommand('basecamp.openCampfire', (element) => {
  const panel = vscode.window.createWebviewPanel(
    'basecampCampfire',
    element.name,
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = getCampfireHtml(element);
});
```

### SecretStorage (OAuth token persistence)

```typescript
// Access via context.secrets in activate()
// Values are strings — serialize tokens to JSON
// Encrypted using OS keychain (macOS Keychain, libsecret, Credential Vault)
// Persists across sessions, scoped to the extension

await context.secrets.store('basecamp-auth', JSON.stringify({
  access_token: '...',
  refresh_token: '...',
  expires_at: '...',
  account_id: '...'
}));

const raw = await context.secrets.get('basecamp-auth');
const auth = raw ? JSON.parse(raw) : undefined;

await context.secrets.delete('basecamp-auth');
```

### WebviewPanel — Creation & Message Passing

```typescript
// Create
const panel = vscode.window.createWebviewPanel(
  'basecampCampfire',             // viewType
  'Campfire — Project Alpha',     // title
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    retainContextWhenHidden: true,  // HIGH memory cost but needed for chat
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview')]
  }
);

// Extension -> Webview
panel.webview.postMessage({ type: 'newLines', data: lines });

// Webview -> Extension
panel.webview.onDidReceiveMessage(message => {
  switch (message.type) {
    case 'sendLine': api.postCampfireLine(chatId, message.content); break;
  }
}, undefined, context.subscriptions);

// Lifecycle
panel.onDidDispose(() => { /* cleanup polling */ }, null, context.subscriptions);
```

**In webview HTML/JS:**

```javascript
const vscode = acquireVsCodeApi();  // Can only be called ONCE

// Send to extension
vscode.postMessage({ type: 'sendLine', content: 'Hello!' });

// Receive from extension
window.addEventListener('message', event => {
  const { type, data } = event.data;
  if (type === 'newLines') renderLines(data);
});

// Persist state across hide/show
vscode.setState({ scrollPos: 150 });
const state = vscode.getState();
```

### CSP for Webviews

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${webview.cspSource};
               script-src 'nonce-${nonce}';
               img-src ${webview.cspSource} https:;">
```

### Notifications

`vscode.window.showInformationMessage` shows **in-editor toasts** (bottom-right), NOT OS-level notifications. They go to the Notification Center when dismissed. There is no built-in VSCode API for OS-level push notifications.

For true OS notifications, use Node.js `node-notifier` package or the `electron` notification API (available since the extension runs in the Electron host process).

---

# Part 3 — MCP Server Implementation

## Packages

```bash
npm install @modelcontextprotocol/sdk zod@3
npm install -D @types/node typescript
```

## Tool Definition (Exact API)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "basecamp",
  version: "1.0.0",
});

server.registerTool(
  "list_projects",
  {
    description: "List all Basecamp projects with their dock (available tools)",
    inputSchema: {},  // No params
  },
  async () => {
    const projects = await api.getProjects();
    return {
      content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
    };
  },
);

server.registerTool(
  "read_campfire",
  {
    description: "Read recent Campfire (chat) messages from a project",
    inputSchema: {
      projectId: z.string().describe("Basecamp project ID"),
      limit: z.number().min(1).max(100).optional().describe("Max messages (default 50)"),
    },
  },
  async ({ projectId, limit }) => {
    // ...
    return {
      content: [{ type: "text", text: formatted }],
    };
  },
);
```

**Key details:**
- `inputSchema` is an object of zod schemas (NOT a single zod object)
- SDK auto-converts zod to JSON Schema for the protocol
- Use `.describe()` for parameter descriptions
- Handler returns `{ content: [{ type: "text", text: "..." }], isError?: boolean }`
- `console.log()` is FORBIDDEN in stdio servers — use `console.error()` for logging

## Transport (stdio)

```typescript
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Basecamp MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

- Claude Code launches the server as a subprocess
- Communication over stdin/stdout using JSON-RPC 2.0 (newline-delimited)
- stderr is available for logging
- stdout is exclusively for protocol messages

## Registration in Claude Code

```bash
# Add to Claude Code (user scope — available in all projects)
claude mcp add --transport stdio --scope user basecamp -- node /absolute/path/to/packages/mcp-server/build/index.js

# With env vars for OAuth token
claude mcp add --transport stdio --scope user --env BASECAMP_ACCESS_TOKEN=xxx basecamp -- node /path/to/build/index.js
```

Or via `.mcp.json` at project root:

```json
{
  "mcpServers": {
    "basecamp": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/build/index.js"],
      "env": {
        "BASECAMP_ACCESS_TOKEN": "${BASECAMP_ACCESS_TOKEN}"
      }
    }
  }
}
```

## Error Handling

```typescript
// Tool execution error (API down, bad data)
return {
  content: [{ type: "text", text: "Failed: API rate limit exceeded" }],
  isError: true,
};
```

## tsconfig.json for MCP server

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

## package.json for MCP server

```json
{
  "name": "mcp-basecamp",
  "version": "1.0.0",
  "type": "module",
  "bin": { "mcp-basecamp": "./build/index.js" },
  "scripts": { "build": "tsc" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

---

# Part 4 — Extension Bundling & Publishing

## Bundling with esbuild

```javascript
// esbuild.js
const esbuild = require('esbuild');
const production = process.argv.includes('--production');

async function main() {
  await esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',          // VSCode extensions use CommonJS
    minify: production,
    sourcemap: !production,
    platform: 'node',        // Extensions run in Node.js
    outfile: 'dist/extension.js',
    external: ['vscode'],    // CRITICAL: vscode is provided at runtime
  });
}

main().catch(() => process.exit(1));
```

## package.json for extension

```json
{
  "name": "basecamp-vscode",
  "displayName": "Basecamp for VSCode",
  "description": "Basecamp projects, campfire chat, to-dos, and messages inside VSCode",
  "version": "0.1.0",
  "publisher": "your-publisher-id",
  "engines": { "vscode": "^1.85.0" },
  "main": "./dist/extension.js",
  "categories": ["Other"],
  "icon": "icon.png",
  "repository": { "type": "git", "url": "https://github.com/..." },
  "scripts": {
    "compile": "tsc --noEmit && node esbuild.js",
    "watch": "node esbuild.js --watch",
    "package": "tsc --noEmit && node esbuild.js --production",
    "vscode:prepublish": "npm run package"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.19.0"
  }
}
```

## Publishing

```bash
npm install -g @vscode/vsce
vsce login <publisher-id>     # Authenticate with Azure DevOps PAT
vsce package                   # Create .vsix
vsce publish                   # Publish to Marketplace
```

---

# Part 5 — Architecture & File Structure

```
basecamp-vscode/
├── packages/
│   ├── extension/
│   │   ├── src/
│   │   │   ├── extension.ts              # activate(), deactivate(), command registration
│   │   │   ├── auth.ts                   # OAuth 2.0 flow (localhost redirect, token refresh)
│   │   │   ├── api/
│   │   │   │   ├── client.ts             # HTTP client (fetch + auth headers + pagination + ETag caching)
│   │   │   │   ├── projects.ts           # getProjects(), getProject()
│   │   │   │   ├── campfires.ts          # getCampfires(), getLines(), postLine()
│   │   │   │   ├── messages.ts           # getMessages(), getMessage(), postMessage()
│   │   │   │   ├── todos.ts              # getTodoLists(), getTodos(), completeTodo()
│   │   │   │   ├── comments.ts           # getComments(), postComment()
│   │   │   │   ├── people.ts             # getPeople(), getProfile()
│   │   │   │   └── types.ts              # TypeScript interfaces for all API responses
│   │   │   ├── views/
│   │   │   │   ├── projectTreeProvider.ts # TreeDataProvider: projects > dock tools > items
│   │   │   │   ├── treeItems.ts          # TreeItem subclasses (ProjectItem, CampfireItem, etc.)
│   │   │   │   └── webviewProvider.ts    # WebviewPanel factory + message routing
│   │   │   ├── panels/
│   │   │   │   ├── campfirePanel.ts      # Campfire chat WebviewPanel
│   │   │   │   ├── messagePanel.ts       # Message thread WebviewPanel
│   │   │   │   └── todoPanel.ts          # To-do list WebviewPanel
│   │   │   ├── services/
│   │   │   │   ├── poller.ts             # Polling loop (configurable interval, ETag-based)
│   │   │   │   ├── badge.ts              # Unread counter management
│   │   │   │   └── notifications.ts      # In-editor + OS notifications
│   │   │   └── utils/
│   │   │       ├── html.ts               # HTML sanitization for Basecamp content
│   │   │       └── nonce.ts              # CSP nonce generation
│   │   ├── webview/
│   │   │   ├── campfire/
│   │   │   │   ├── index.html
│   │   │   │   ├── style.css
│   │   │   │   └── script.js
│   │   │   ├── message/
│   │   │   │   ├── index.html
│   │   │   │   ├── style.css
│   │   │   │   └── script.js
│   │   │   ├── todo/
│   │   │   │   ├── index.html
│   │   │   │   ├── style.css
│   │   │   │   └── script.js
│   │   │   └── shared/
│   │   │       ├── base.css              # Shared styles (Basecamp-inspired)
│   │   │       └── vscode-api.js         # acquireVsCodeApi() wrapper
│   │   ├── resources/
│   │   │   └── basecamp-icon.svg
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── esbuild.js
│   │
│   └── mcp-server/
│       ├── src/
│       │   ├── index.ts                  # McpServer setup + tool registration
│       │   ├── auth.ts                   # Token loading (env var or file)
│       │   ├── api/
│       │   │   ├── client.ts             # Shared HTTP client (reuse from extension or standalone)
│       │   │   └── types.ts              # Shared types
│       │   └── tools/
│       │       ├── projects.ts           # list_projects tool
│       │       ├── campfires.ts          # read_campfire tool
│       │       ├── messages.ts           # read_message, list_messages tools
│       │       ├── todos.ts              # list_todos, complete_todo tools
│       │       ├── comments.ts           # read_comments, post_comment tools
│       │       └── people.ts             # list_people, my_profile tools
│       ├── package.json
│       └── tsconfig.json
│
├── package.json              # Workspace root (npm workspaces)
├── LICENSE
└── README.md
```

---

# Part 6 — MCP Server Tools (Full Spec)

| Tool | Description | Parameters |
|---|---|---|
| `list_projects` | List all Basecamp projects with names, IDs, and dock | none |
| `read_campfire` | Read recent chat messages from a Campfire | `projectId`, `limit?` |
| `read_message` | Read a message thread with all comments | `messageId` |
| `list_messages` | List messages from a project's message board | `projectId`, `limit?` |
| `list_todo_lists` | List to-do lists from a project | `projectId` |
| `list_todos` | List to-dos from a to-do list | `todolistId`, `completed?` |
| `complete_todo` | Mark a to-do as complete | `todoId` |
| `read_comments` | Read comments on any recording | `recordingId` |
| `post_comment` | Post a comment on any recording | `recordingId`, `content` |
| `post_campfire_line` | Send a message to a Campfire | `chatId`, `content` |
| `list_people` | List all people in the Basecamp account | none |
| `my_profile` | Get the authenticated user's profile | none |

---

# Part 7 — Development Roadmap

### Phase 1: MCP Server

- OAuth 2.0 token loading (env var initially, browser flow later)
- All 12 tools listed above
- Register in Claude Code
- **Result**: Claude Code reads and interacts with Basecamp

### Phase 2: VSCode Extension MVP

- Sidebar TreeView with projects and their dock tools
- WebviewPanel for Campfire (read + send messages)
- WebviewPanel for message threads (read + comment)
- To-do list view (read + toggle completion)
- Activity badge on sidebar icon
- Polling every 15 seconds with ETag caching
- OAuth flow via localhost redirect + SecretStorage

### Phase 3: Full Experience

- Rich HTML rendering for messages
- File/document browser in sidebar
- To-do creation and assignment
- Search across all projects
- OS notifications (via node-notifier)
- Configurable polling interval

### Phase 4: Advanced (optional)

- Webhook relay via Cloudflare Worker for real-time
- Campfire typing indicators
- Drag-and-drop file uploads
- Shared API client between extension and MCP server

---

# Part 8 — Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| OAuth token expiry | Low | Use refresh tokens; auto-renew in background |
| Rate limiting with polling | Low | 50 req/10s is generous; use ETag caching for 304 responses |
| Rich HTML rendering in webview | Medium | Sanitize Basecamp HTML; render subset of styles |
| API changes | Very Low | 37signals has excellent API stability track record |
| Webhook HTTPS requirement | Medium | Start with polling; add relay server later |
| Scope creep (full Basecamp clone) | Medium | Stick to MVP; Basecamp web UI handles edge cases |
| `showInformationMessage` not OS-level | Low | Use `node-notifier` for true OS notifications |

---

# References

- [Basecamp 4 API Documentation (GitHub)](https://github.com/basecamp/bc3-api)
- [Campfires API](https://github.com/basecamp/bc3-api/blob/master/sections/campfires.md)
- [Message Boards API](https://github.com/basecamp/bc3-api/blob/master/sections/message_boards.md)
- [Messages API](https://github.com/basecamp/bc3-api/blob/master/sections/messages.md)
- [To-dos API](https://github.com/basecamp/bc3-api/blob/master/sections/todos.md)
- [To-do Lists API](https://github.com/basecamp/bc3-api/blob/master/sections/todolists.md)
- [Comments API](https://github.com/basecamp/bc3-api/blob/master/sections/comments.md)
- [People API](https://github.com/basecamp/bc3-api/blob/master/sections/people.md)
- [Webhooks API](https://github.com/basecamp/bc3-api/blob/master/sections/webhooks.md)
- [Chatbots API](https://github.com/basecamp/bc3-api/blob/master/sections/chatbots.md)
- [MCP Server Quickstart](https://modelcontextprotocol.io/quickstart/server)
- [MCP Tools Spec](https://modelcontextprotocol.io/docs/concepts/tools)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code MCP Configuration](https://code.claude.com/docs/en/mcp)
- [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VSCode TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [VSCode Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [VSCode Sidebar Guidelines](https://code.visualstudio.com/api/ux-guidelines/sidebars)
- [VSCode Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
