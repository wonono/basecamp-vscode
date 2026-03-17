import * as vscode from "vscode";
import { AuthManager } from "./auth";
import { BasecampClient } from "./api/client";
import { PollingService } from "./services/poller";
import { BadgeService } from "./services/badge";
import { ProjectTreeProvider } from "./views/projectTreeProvider";
import { CampfirePanel } from "./panels/campfirePanel";
import { MessagePanel } from "./panels/messagePanel";
import { TodoPanel } from "./panels/todoPanel";
import { BasecampContentProvider } from "./providers/basecampContentProvider";
import { BasecampCodeLensProvider } from "./providers/basecampCodeLensProvider";
import { postMessage } from "./api/messages";
import { postComment } from "./api/comments";
import { createTodo, completeTodo, uncompleteTodo } from "./api/todos";
import type { Campfire, Message, TodoList, Project } from "./api/types";
import type { DocumentMeta } from "./providers/basecampContentProvider";
import {
  ProjectItem,
  DockToolItem,
  CampfireItem,
  MessageItem,
  TodoListItem,
} from "./views/treeItems";

let authManager: AuthManager;
let pollingService: PollingService;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize auth
  authManager = new AuthManager(context.secrets);
  await authManager.initialize();
  context.subscriptions.push(authManager);

  // Set context for menu visibility
  vscode.commands.executeCommand(
    "setContext",
    "basecamp.isAuthenticated",
    authManager.isAuthenticated
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  statusBar.command = "workbench.view.extension.basecamp-explorer";
  function updateStatusBar() {
    if (authManager.isAuthenticated) {
      statusBar.text = "$(flame) Basecamp";
      statusBar.tooltip = "Open Basecamp sidebar";
      statusBar.show();
    } else {
      statusBar.hide();
    }
  }
  updateStatusBar();
  context.subscriptions.push(statusBar);

  // Initialize services
  pollingService = new PollingService();
  context.subscriptions.push(pollingService);

  const badgeService = new BadgeService();

  // Initialize API client
  const client = new BasecampClient(
    async () => {
      const tokens = await authManager.getTokens();
      return {
        accessToken: tokens.access_token,
        accountId: tokens.account_id,
      };
    },
    async () => {
      await authManager.getTokens(); // triggers refresh if needed
    }
  );

  // --- Markdown content provider + CodeLens ---
  const contentProvider = new BasecampContentProvider(client);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider("basecamp", contentProvider)
  );

  const codeLensProvider = new BasecampCodeLensProvider(contentProvider);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ scheme: "basecamp" }, codeLensProvider)
  );

  // Open content in editor (for Campfire's ⎘ button)
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.openInEditor", async (data: { title: string; content: string }) => {
      const doc = await vscode.workspace.openTextDocument({
        content: data.content,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    })
  );

  // --- CodeLens commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.md.refreshDoc", (uri: vscode.Uri) => {
      contentProvider.refresh(uri);
      codeLensProvider.notifyChange();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.md.openInBrowser", (url: string) => {
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.md.richView", (_uri: vscode.Uri, meta: DocumentMeta) => {
      // Re-open as webview panel
      if (meta.type === "message" && meta.messageId) {
        // We need the message object — fetch it
        client.get<Message>(`/buckets/${meta.projectId}/messages/${meta.messageId}.json`).then((msg) => {
          const project = { id: meta.projectId, name: "Basecamp" } as Project;
          MessagePanel.show(msg, project, client, context.extensionUri);
        });
      } else if (meta.type === "todolist") {
        client.get<TodoList>(`/todolists/${meta.entityId}.json`).then((list) => {
          const project = { id: meta.projectId, name: "Basecamp" } as Project;
          TodoPanel.show(list, project, client, context.extensionUri);
        });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.md.addComment", async (uri: vscode.Uri, projectId: number, recordingId: number) => {
      const content = await vscode.window.showInputBox({
        prompt: "Write a comment",
        placeHolder: "Your comment...",
      });
      if (!content) return;
      try {
        await postComment(client, projectId, recordingId, content);
        contentProvider.refresh(uri);
        codeLensProvider.notifyChange();
        vscode.window.showInformationMessage("Comment posted.");
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to post comment: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.md.completeTodo", async (uri: vscode.Uri, projectId: number, todoId: number) => {
      try {
        await completeTodo(client, projectId, todoId);
        contentProvider.refresh(uri);
        codeLensProvider.notifyChange();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to complete to-do: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.md.uncompleteTodo", async (uri: vscode.Uri, projectId: number, todoId: number) => {
      try {
        await uncompleteTodo(client, projectId, todoId);
        contentProvider.refresh(uri);
        codeLensProvider.notifyChange();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to uncomplete to-do: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.md.addTodo", async (uri: vscode.Uri, projectId: number, todoListId: number) => {
      const content = await vscode.window.showInputBox({
        prompt: "To-do title",
        placeHolder: "What needs to be done?",
      });
      if (!content) return;
      try {
        await createTodo(client, projectId, todoListId, content);
        contentProvider.refresh(uri);
        codeLensProvider.notifyChange();
        vscode.window.showInformationMessage(`To-do "${content}" created.`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to create to-do: ${(err as Error).message}`);
      }
    })
  );

  // --- Tree view ---
  const treeProvider = new ProjectTreeProvider(client, authManager);
  const treeView = vscode.window.createTreeView("basecamp-projects", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);
  badgeService.setTreeView(treeView);

  // Refresh tree on auth changes
  authManager.onDidChangeAuth(() => {
    vscode.commands.executeCommand(
      "setContext",
      "basecamp.isAuthenticated",
      authManager.isAuthenticated
    );
    updateStatusBar();
    treeProvider.refresh();
    if (!authManager.isAuthenticated) {
      pollingService.stop();
      badgeService.resetAll();
      client.clearCache();
    }
  });

  // --- Tree commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.signIn", async () => {
      try {
        await authManager.signIn();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Sign in failed: ${(err as Error).message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.signOut", async () => {
      await authManager.signOut();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.refresh", () => {
      client.clearCache();
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "basecamp.openCampfire",
      (campfire: Campfire, project: Project) => {
        CampfirePanel.show(
          campfire,
          project,
          client,
          pollingService,
          badgeService,
          context.extensionUri
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "basecamp.openMessage",
      (message: Message, project: Project) => {
        MessagePanel.show(message, project, client, context.extensionUri);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "basecamp.openTodoList",
      (todoList: TodoList, project: Project) => {
        TodoPanel.show(todoList, project, client, context.extensionUri);
      }
    )
  );

  // Open in Basecamp (browser) — tree context menu
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.openInBrowser", (item: unknown) => {
      let url: string | undefined;
      if (item instanceof ProjectItem) {
        url = item.project.app_url;
      } else if (item instanceof CampfireItem) {
        url = item.campfire.app_url;
      } else if (item instanceof MessageItem) {
        url = item.message.app_url;
      } else if (item instanceof TodoListItem) {
        url = item.todoList.parent?.app_url;
      }
      if (url) {
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    })
  );

  // Search across projects
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.search", async () => {
      if (!authManager.isAuthenticated) return;
      const query = await vscode.window.showInputBox({
        prompt: "Search Basecamp",
        placeHolder: "Search messages, to-dos...",
      });
      if (!query) return;
      try {
        const tokens = await authManager.getTokens();
        const accountId = tokens.account_id;
        const url = `https://3.basecamp.com/${accountId}/search?search=${encodeURIComponent(query)}`;
        vscode.env.openExternal(vscode.Uri.parse(url));
      } catch {
        // ignore
      }
    })
  );

  // Create new message (tree context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.createMessage", async (item: unknown) => {
      if (!(item instanceof DockToolItem)) return;
      const project = item.project;
      const subject = await vscode.window.showInputBox({
        prompt: "Message subject",
        placeHolder: "Enter a subject for your message...",
      });
      if (!subject) return;

      try {
        const boardUrl = item.dock.url;
        const board = await client.get<{ id: number }>(boardUrl);
        await postMessage(client, project.id, board.id, subject, "");
        vscode.window.showInformationMessage(`Message "${subject}" posted.`);
        client.clearCache();
        treeProvider.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to post message: ${(err as Error).message}`
        );
      }
    })
  );

  // Create new todo (tree context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.createTodo", async (item: unknown) => {
      if (!(item instanceof DockToolItem)) return;
      const project = item.project;
      const content = await vscode.window.showInputBox({
        prompt: "To-do title",
        placeHolder: "What needs to be done?",
      });
      if (!content) return;

      try {
        const todosetUrl = item.dock.url;
        const todoset = await client.get<{ todolists_url: string }>(todosetUrl);
        const lists = await client.getPaginated<{ id: number; name: string }>(
          todoset.todolists_url
        );
        if (lists.length === 0) {
          vscode.window.showWarningMessage("No to-do lists found in this project.");
          return;
        }
        let listId = lists[0].id;
        if (lists.length > 1) {
          const pick = await vscode.window.showQuickPick(
            lists.map((l) => ({ label: l.name, id: l.id })),
            { placeHolder: "Pick a to-do list" }
          );
          if (!pick) return;
          listId = pick.id;
        }
        await createTodo(client, project.id, listId, content);
        vscode.window.showInformationMessage(`To-do "${content}" created.`);
        client.clearCache();
        treeProvider.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to create to-do: ${(err as Error).message}`
        );
      }
    })
  );
}

export function deactivate(): void {
  pollingService?.dispose();
}
