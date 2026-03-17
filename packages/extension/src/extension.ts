import * as vscode from "vscode";
import { AuthManager } from "./auth";
import { BasecampClient } from "./api/client";
import { PollingService } from "./services/poller";
import { BadgeService } from "./services/badge";
import { ProjectTreeProvider } from "./views/projectTreeProvider";
import { CampfirePanel } from "./panels/campfirePanel";
import { MessagePanel } from "./panels/messagePanel";
import { TodoPanel } from "./panels/todoPanel";
import { postMessage } from "./api/messages";
import { createTodo } from "./api/todos";
import type { Campfire, Message, TodoList, Project } from "./api/types";
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

  // Open content in editor (for Option+K / AI assist)
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.openInEditor", async (data: { title: string; content: string }) => {
      const doc = await vscode.workspace.openTextDocument({
        content: data.content,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    })
  );

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

  // Initialize tree view
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

  // Register commands
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

  // Open in Basecamp (browser)
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

  // Create new message
  context.subscriptions.push(
    vscode.commands.registerCommand("basecamp.createMessage", async (item: unknown) => {
      if (!(item instanceof DockToolItem)) return;
      const project = item.project;
      const subject = await vscode.window.showInputBox({
        prompt: "Message subject",
        placeHolder: "Enter a subject for your message...",
      });
      if (!subject) return;

      const content = await vscode.window.showInputBox({
        prompt: "Message content",
        placeHolder: "Enter the message content...",
      });
      if (!content) return;

      try {
        const boardUrl = item.dock.url;
        const board = await client.get<{ id: number }>(boardUrl);
        await postMessage(client, project.id, board.id, subject, content);
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

  // Create new todo (quick add from tree)
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
