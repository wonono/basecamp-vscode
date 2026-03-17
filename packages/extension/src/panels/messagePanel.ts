import * as vscode from "vscode";
import type { BasecampClient } from "../api/client";
import type { Message, Comment, Project } from "../api/types";
import { getMessage } from "../api/messages";
import { getComments, postComment } from "../api/comments";
import { sanitizeHtml } from "../utils/html";
import { createWebviewPanel, getWebviewHtml } from "../views/webviewProvider";

const openPanels = new Map<string, MessagePanel>();

export class MessagePanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static show(
    message: Message,
    project: Project,
    client: BasecampClient,
    extensionUri: vscode.Uri
  ): MessagePanel {
    const key = `message-${message.id}`;
    const existing = openPanels.get(key);
    if (existing) {
      existing.panel.reveal();
      return existing;
    }
    const instance = new MessagePanel(message, project, client, extensionUri);
    openPanels.set(key, instance);
    return instance;
  }

  private constructor(
    private readonly message: Message,
    private readonly project: Project,
    private readonly client: BasecampClient,
    extensionUri: vscode.Uri
  ) {
    this.panel = createWebviewPanel({
      viewType: "basecampMessage",
      title: message.subject,
      extensionUri,
      extraStyleSrc: "'unsafe-inline'",
    });

    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      extensionUri,
      "message",
      "'unsafe-inline'"
    );

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private async handleMessage(msg: { type: string; data?: unknown }): Promise<void> {
    switch (msg.type) {
      case "ready":
        await this.loadContent();
        break;
      case "openInEditor": {
        const { text } = msg.data as { text: string };
        vscode.commands.executeCommand("basecamp.openInEditor", {
          title: this.message.subject,
          content: text,
        });
        break;
      }
      case "postComment": {
        const { content } = msg.data as { content: string };
        try {
          const comment = await postComment(
            this.client,
            this.project.id,
            this.message.id,
            content
          );
          this.panel.webview.postMessage({
            type: "commentPosted",
            data: { comment: this.sanitizeComment(comment) },
          });
        } catch (err) {
          this.panel.webview.postMessage({
            type: "error",
            data: { message: `Failed to post comment: ${(err as Error).message}` },
          });
        }
        break;
      }
      case "openExternal": {
        const { url } = msg.data as { url: string };
        if (url.startsWith("https://")) {
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
      }
    }
  }

  private async loadContent(): Promise<void> {
    try {
      const msg = await getMessage(
        this.client,
        this.project.id,
        this.message.id
      );

      const comments = msg.comments_count > 0
        ? await getComments(this.client, msg.comments_url)
        : [];

      this.panel.webview.postMessage({
        type: "init",
        data: {
          message: {
            subject: msg.subject,
            content: sanitizeHtml(msg.content),
            creator: msg.creator,
            created_at: msg.created_at,
            comments_count: msg.comments_count,
          },
          comments: comments.map((c) => this.sanitizeComment(c)),
        },
      });
    } catch (err) {
      this.panel.webview.postMessage({
        type: "error",
        data: { message: `Failed to load message: ${(err as Error).message}` },
      });
    }
  }

  private sanitizeComment(comment: Comment) {
    return {
      id: comment.id,
      creator: comment.creator,
      created_at: comment.created_at,
      content: sanitizeHtml(comment.content),
    };
  }

  private dispose(): void {
    openPanels.delete(`message-${this.message.id}`);
    this.disposables.forEach((d) => d.dispose());
  }
}
