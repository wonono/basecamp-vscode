import * as vscode from "vscode";
import type { BasecampClient } from "../api/client";
import type { Message, Todo, Comment } from "../api/types";
import { getMessage } from "../api/messages";
import { getComments } from "../api/comments";
import { getTodos } from "../api/todos";
import { htmlToMarkdown } from "../utils/htmlToMarkdown";

export interface DocumentMeta {
  type: "message" | "todolist";
  projectId: number;
  entityId: number;
  appUrl?: string;
  /** For todo lists: maps line numbers to todo IDs */
  todoLines: Map<number, { id: number; completed: boolean; commentsUrl: string }>;
  /** For messages: the recording ID for posting comments */
  messageId?: number;
  commentsUrl?: string;
}

export class BasecampContentProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private readonly meta = new Map<string, DocumentMeta>();

  constructor(private readonly client: BasecampClient) {}

  getMeta(uri: vscode.Uri): DocumentMeta | undefined {
    return this.meta.get(uri.toString());
  }

  refresh(uri: vscode.Uri): void {
    this._onDidChange.fire(uri);
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const path = uri.path; // e.g. /message/123/456 or /todolist/123/789
    const parts = path.split("/").filter(Boolean);

    if (parts[0] === "message" && parts.length >= 3) {
      return this.renderMessage(parseInt(parts[1]), parseInt(parts[2]));
    }

    if (parts[0] === "todolist" && parts.length >= 3) {
      return this.renderTodoList(parseInt(parts[1]), parseInt(parts[2]), uri);
    }

    return "# Unknown Basecamp resource";
  }

  private async renderMessage(projectId: number, messageId: number): Promise<string> {
    const msg = await getMessage(this.client, projectId, messageId);
    const comments = msg.comments_count > 0
      ? await getComments(this.client, msg.comments_url)
      : [];

    const date = new Date(msg.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const body = htmlToMarkdown(msg.content);

    const lines: string[] = [
      `# ${msg.subject}`,
      "",
      `> **${msg.creator.name}** — ${date}`,
      "",
      "---",
      "",
      body,
    ];

    if (comments.length > 0) {
      lines.push("", "---", "", `## Comments (${comments.length})`, "");
      for (const c of comments) {
        const cDate = new Date(c.created_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        lines.push(`**${c.creator.name}** — ${cDate}`);
        lines.push(htmlToMarkdown(c.content));
        lines.push("");
      }
    }

    const uri = BasecampContentProvider.messageUri(projectId, messageId, msg.subject);
    this.meta.set(uri.toString(), {
      type: "message",
      projectId,
      entityId: messageId,
      appUrl: msg.app_url,
      todoLines: new Map(),
      messageId: msg.id,
      commentsUrl: msg.comments_url,
    });

    return lines.join("\n");
  }

  private async renderTodoList(projectId: number, todoListId: number, uri: vscode.Uri): Promise<string> {
    const [active, completed] = await Promise.all([
      getTodos(this.client, `/todolists/${todoListId}/todos.json`),
      getTodos(this.client, `/todolists/${todoListId}/todos.json`, true),
    ]);

    // We need the list name — get it from the first todo's parent, or use a fallback
    const firstTodo = active[0] ?? completed[0];
    const listName = firstTodo?.parent?.title ?? "To-do List";
    const total = active.length + completed.length;
    const ratio = `${completed.length}/${total}`;

    const todoLineMap = new Map<number, { id: number; completed: boolean; commentsUrl: string }>();
    const lines: string[] = [
      `# ${listName}`,
      "",
      `> Progress: ${ratio} completed`,
      "",
      "---",
    ];

    if (active.length > 0) {
      lines.push("", "## Active", "");
      for (const t of active) {
        const lineNum = lines.length;
        todoLineMap.set(lineNum, { id: t.id, completed: false, commentsUrl: t.comments_url });
        lines.push(`- [ ] ${t.content}`);
        const meta: string[] = [];
        if (t.assignees.length > 0) {
          meta.push(`Assigned to: ${t.assignees.map(a => a.name).join(", ")}`);
        }
        if (t.due_on) {
          const overdue = new Date(t.due_on) < new Date();
          meta.push(`Due: ${t.due_on}${overdue ? " **OVERDUE**" : ""}`);
        }
        if (t.comments_count > 0) {
          meta.push(`${t.comments_count} comment(s)`);
        }
        if (meta.length > 0) {
          lines.push(`  *${meta.join(" | ")}*`);
        }
        if (t.description) {
          const notes = htmlToMarkdown(t.description).trim();
          if (notes) {
            for (const noteLine of notes.split("\n")) {
              lines.push(`  ${noteLine}`);
            }
          }
        }
        lines.push("");
      }
    }

    if (completed.length > 0) {
      lines.push("## Completed", "");
      for (const t of completed) {
        const lineNum = lines.length;
        todoLineMap.set(lineNum, { id: t.id, completed: true, commentsUrl: t.comments_url });
        lines.push(`- [x] ~~${t.content}~~`);
        lines.push("");
      }
    }

    const appUrl = firstTodo?.parent?.app_url;
    this.meta.set(uri.toString(), {
      type: "todolist",
      projectId,
      entityId: todoListId,
      appUrl,
      todoLines: todoLineMap,
    });

    return lines.join("\n");
  }

  // --- Static URI builders ---

  static messageUri(projectId: number, messageId: number, subject: string): vscode.Uri {
    const slug = subject.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 50);
    return vscode.Uri.parse(`basecamp://content/message/${projectId}/${messageId}/${slug}.md`);
  }

  static todoListUri(projectId: number, todoListId: number, name: string): vscode.Uri {
    const slug = name.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 50);
    return vscode.Uri.parse(`basecamp://content/todolist/${projectId}/${todoListId}/${slug}.md`);
  }
}
