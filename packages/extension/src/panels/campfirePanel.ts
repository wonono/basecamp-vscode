import * as vscode from "vscode";
import type { BasecampClient } from "../api/client";
import type { Campfire, CampfireLine, Project } from "../api/types";
import { getLinesWithEtag, postLine } from "../api/campfires";
import { PollingService } from "../services/poller";
import { createWebviewPanel, getWebviewHtml } from "../views/webviewProvider";

const openPanels = new Map<string, CampfirePanel>();

export class CampfirePanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private lastLineIds = new Set<number>();

  static show(
    campfire: Campfire,
    project: Project,
    client: BasecampClient,
    poller: PollingService,
    extensionUri: vscode.Uri
  ): CampfirePanel {
    const key = `campfire-${campfire.id}`;
    const existing = openPanels.get(key);
    if (existing) {
      existing.panel.reveal();
      return existing;
    }
    const instance = new CampfirePanel(
      campfire,
      project,
      client,
      poller,
      extensionUri
    );
    openPanels.set(key, instance);
    return instance;
  }

  private constructor(
    private readonly campfire: Campfire,
    private readonly project: Project,
    private readonly client: BasecampClient,
    private readonly poller: PollingService,
    extensionUri: vscode.Uri
  ) {
    this.panel = createWebviewPanel({
      viewType: "basecampCampfire",
      title: `Campfire — ${project.name}`,
      extensionUri,
      retainContextWhenHidden: true,
    });

    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      extensionUri,
      "campfire"
    );

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Start polling for new lines
    const pollKey = `campfire-lines-${campfire.id}`;
    const config = vscode.workspace.getConfiguration("basecamp");
    const intervalMs = (config.get<number>("pollingInterval") ?? 15) * 1000;

    const sub = poller.subscribe(
      pollKey,
      () => getLinesWithEtag(client, campfire.lines_url),
      intervalMs,
      (result) => {
        const { data, changed } = result as {
          data: CampfireLine[];
          changed: boolean;
        };
        if (changed) {
          this.sendNewLines(data);
        }
      }
    );
    this.disposables.push(sub);
  }

  private async handleMessage(msg: { type: string; data?: unknown }): Promise<void> {
    switch (msg.type) {
      case "ready":
        await this.loadInitialLines();
        break;
      case "sendLine": {
        const { content, clientId } = msg.data as {
          content: string;
          clientId: string;
        };
        try {
          const line = await postLine(
            this.client,
            this.campfire.lines_url,
            content
          );
          this.lastLineIds.add(line.id);
          this.panel.webview.postMessage({
            type: "lineSent",
            data: { clientId, line },
          });
        } catch (err) {
          this.panel.webview.postMessage({
            type: "error",
            data: { message: `Failed to send: ${(err as Error).message}` },
          });
        }
        break;
      }
    }
  }

  private async loadInitialLines(): Promise<void> {
    try {
      const lines = await this.client.getPaginated<CampfireLine>(
        this.campfire.lines_url,
        50
      );
      this.lastLineIds = new Set(lines.map((l) => l.id));
      this.panel.webview.postMessage({
        type: "init",
        data: { lines, projectName: this.project.name },
      });
    } catch (err) {
      this.panel.webview.postMessage({
        type: "error",
        data: { message: `Failed to load messages: ${(err as Error).message}` },
      });
    }
  }

  private sendNewLines(lines: CampfireLine[]): void {
    const newLines = lines.filter((l) => !this.lastLineIds.has(l.id));
    if (newLines.length > 0) {
      for (const l of newLines) {
        this.lastLineIds.add(l.id);
      }
      // Keep tracked IDs bounded
      if (this.lastLineIds.size > 500) {
        const ids = Array.from(this.lastLineIds);
        this.lastLineIds = new Set(ids.slice(ids.length - 300));
      }
      this.panel.webview.postMessage({ type: "newLines", data: { lines: newLines } });
    }
  }

  private dispose(): void {
    const key = `campfire-${this.campfire.id}`;
    openPanels.delete(key);
    this.disposables.forEach((d) => d.dispose());
  }
}
