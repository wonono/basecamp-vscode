import * as vscode from "vscode";
import type { BasecampClient } from "../api/client";
import type { AuthManager } from "../auth";
import type { Campfire, Message, TodoList, DockItem } from "../api/types";
import { getProjects } from "../api/projects";
import {
  CategoryItem,
  ProjectItem,
  DockToolItem,
  CampfireItem,
  MessageItem,
  TodoListItem,
} from "./treeItems";

type TreeNode = CategoryItem | ProjectItem | DockToolItem | CampfireItem | MessageItem | TodoListItem;

export class ProjectTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly client: BasecampClient,
    private readonly auth: AuthManager
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!this.auth.isAuthenticated) {
      return [];
    }

    try {
      // Root: list categories
      if (!element) {
        const projects = await getProjects(this.client);
        const active = projects.filter((p) => p.status === "active");
        const pinned = active.filter((p) => p.bookmarked);
        const hasPinned = pinned.length > 0;
        const nodes: TreeNode[] = [];
        if (hasPinned) {
          nodes.push(new CategoryItem("pinned", pinned, true));
        }
        nodes.push(new CategoryItem("projects", active, hasPinned));
        return nodes;
      }

      // Category: list projects in that category
      if (element instanceof CategoryItem) {
        return element.projects.map((p) => new ProjectItem(p));
      }

      // Project: list enabled dock items
      if (element instanceof ProjectItem) {
        const supportedDocks = ["chat", "message_board", "todoset"];
        return element.project.dock
          .filter((d) => d.enabled && supportedDocks.includes(d.name))
          .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
          .map((d) => new DockToolItem(d, element.project));
      }

      // Dock tool: list items based on dock type
      if (element instanceof DockToolItem) {
        return this.getDockChildren(element.dock, element.project);
      }

      return [];
    } catch (err) {
      console.error("TreeView error:", err);
      return [];
    }
  }

  private async getDockChildren(
    dock: DockItem,
    project: import("../api/types").Project
  ): Promise<TreeNode[]> {
    switch (dock.name) {
      case "chat": {
        const campfire = await this.client.get<Campfire>(dock.url);
        return [new CampfireItem(campfire, project)];
      }
      case "message_board": {
        const board = await this.client.get<{ messages_url: string }>(dock.url);
        const messages = await this.client.getPaginated<Message>(
          board.messages_url,
          15
        );
        return messages.map((m) => new MessageItem(m, project));
      }
      case "todoset": {
        const todoset = await this.client.get<{ todolists_url: string }>(dock.url);
        const lists = await this.client.getPaginated<TodoList>(
          todoset.todolists_url
        );
        return lists
          .filter((l) => !l.completed)
          .map((l) => new TodoListItem(l, project));
      }
      default:
        return [];
    }
  }
}
