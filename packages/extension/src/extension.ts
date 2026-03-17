import * as vscode from "vscode";
import { AuthManager } from "./auth";
import { BasecampClient } from "./api/client";
import { PollingService } from "./services/poller";
import { BadgeService } from "./services/badge";
import { ProjectTreeProvider } from "./views/projectTreeProvider";
import { CampfirePanel } from "./panels/campfirePanel";
import { MessagePanel } from "./panels/messagePanel";
import { TodoPanel } from "./panels/todoPanel";
import type { Campfire, Message, TodoList, Project } from "./api/types";

let authManager: AuthManager;
let pollingService: PollingService;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize auth
  authManager = new AuthManager(context.secrets);
  await authManager.initialize();
  context.subscriptions.push(authManager);

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
}

export function deactivate(): void {
  pollingService?.dispose();
}
