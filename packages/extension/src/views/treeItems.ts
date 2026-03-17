import * as vscode from "vscode";
import type { Project, DockItem, Campfire, Message, TodoList } from "../api/types";

export class ProjectItem extends vscode.TreeItem {
  constructor(public readonly project: Project) {
    super(project.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `project-${project.id}`;
    this.description = project.description || undefined;
    this.tooltip = `${project.name}\n${project.description || ""}`;
    this.iconPath = new vscode.ThemeIcon("project");
    this.contextValue = "basecamp-project";
  }
}

const DOCK_ICONS: Record<string, string> = {
  chat: "comment-discussion",
  message_board: "mail",
  todoset: "checklist",
  vault: "file-directory",
  schedule: "calendar",
  questionnaire: "question",
  inbox: "inbox",
  kanban_board: "layout",
};

export class DockToolItem extends vscode.TreeItem {
  constructor(
    public readonly dock: DockItem,
    public readonly project: Project
  ) {
    super(dock.title, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `dock-${project.id}-${dock.name}`;
    this.iconPath = new vscode.ThemeIcon(DOCK_ICONS[dock.name] ?? "extensions");
    this.contextValue = `basecamp-dock-${dock.name}`;
  }
}

export class CampfireItem extends vscode.TreeItem {
  constructor(
    public readonly campfire: Campfire,
    public readonly project: Project
  ) {
    super(campfire.topic || "Chat", vscode.TreeItemCollapsibleState.None);
    this.id = `campfire-${campfire.id}`;
    this.description = campfire.bucket.name;
    this.iconPath = new vscode.ThemeIcon("comment-discussion");
    this.contextValue = "basecamp-campfire";
    this.command = {
      command: "basecamp.openCampfire",
      title: "Open Campfire",
      arguments: [campfire, project],
    };
  }
}

export class MessageItem extends vscode.TreeItem {
  constructor(
    public readonly message: Message,
    public readonly project: Project
  ) {
    super(message.subject, vscode.TreeItemCollapsibleState.None);
    this.id = `message-${message.id}`;
    this.description = `${message.creator.name} · ${message.comments_count} comment(s)`;
    this.iconPath = new vscode.ThemeIcon("mail");
    this.contextValue = "basecamp-message";
    this.command = {
      command: "basecamp.openMessage",
      title: "Open Message",
      arguments: [message, project],
    };
  }
}

export class TodoListItem extends vscode.TreeItem {
  constructor(
    public readonly todoList: TodoList,
    public readonly project: Project
  ) {
    super(todoList.name, vscode.TreeItemCollapsibleState.None);
    this.id = `todolist-${todoList.id}`;
    this.description = todoList.completed_ratio;
    this.iconPath = new vscode.ThemeIcon(
      todoList.completed ? "pass-filled" : "checklist"
    );
    this.contextValue = "basecamp-todolist";
    this.command = {
      command: "basecamp.openTodoList",
      title: "Open To-do List",
      arguments: [todoList, project],
    };
  }
}
