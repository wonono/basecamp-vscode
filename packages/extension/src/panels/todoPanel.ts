import * as vscode from "vscode";
import type { BasecampClient } from "../api/client";
import type { TodoList, Todo, Project } from "../api/types";
import { getTodos } from "../api/todos";
import { completeTodo, uncompleteTodo, createTodo } from "../api/todos";
import { getComments, postComment } from "../api/comments";
import { getPeople } from "../api/people";
import { createWebviewPanel, getWebviewHtml } from "../views/webviewProvider";

const openPanels = new Map<string, TodoPanel>();

export class TodoPanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static show(
    todoList: TodoList,
    project: Project,
    client: BasecampClient,
    extensionUri: vscode.Uri
  ): TodoPanel {
    const key = `todolist-${todoList.id}`;
    const existing = openPanels.get(key);
    if (existing) {
      existing.panel.reveal();
      return existing;
    }
    const instance = new TodoPanel(todoList, project, client, extensionUri);
    openPanels.set(key, instance);
    return instance;
  }

  private constructor(
    private readonly todoList: TodoList,
    private readonly project: Project,
    private readonly client: BasecampClient,
    extensionUri: vscode.Uri
  ) {
    this.panel = createWebviewPanel({
      viewType: "basecampTodo",
      title: `To-dos — ${todoList.name}`,
      extensionUri,
    });

    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      extensionUri,
      "todo"
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
        await this.loadTodos();
        break;
      case "toggleTodo": {
        const { todoId, completed } = msg.data as {
          todoId: number;
          completed: boolean;
        };
        try {
          if (completed) {
            await completeTodo(this.client, this.project.id, todoId);
          } else {
            await uncompleteTodo(this.client, this.project.id, todoId);
          }
          this.panel.webview.postMessage({
            type: "todoUpdated",
            data: { todoId, completed },
          });
        } catch (err) {
          this.panel.webview.postMessage({
            type: "error",
            data: {
              message: `Failed to update to-do: ${(err as Error).message}`,
              todoId,
            },
          });
        }
        break;
      }
      case "loadPeople": {
        try {
          const people = await getPeople(this.client);
          this.panel.webview.postMessage({
            type: "people",
            data: { people: people.map((p) => ({ id: p.id, name: p.name })) },
          });
        } catch {
          // silently ignore — assignee picker just won't populate
        }
        break;
      }
      case "createTodo": {
        const { content, description, assigneeIds, dueOn } = msg.data as {
          content: string;
          description?: string;
          assigneeIds?: number[];
          dueOn?: string;
        };
        try {
          const todo = await createTodo(
            this.client,
            this.project.id,
            this.todoList.id,
            content,
            description,
            assigneeIds,
            dueOn
          );
          this.panel.webview.postMessage({
            type: "todoCreated",
            data: { todo },
          });
        } catch (err) {
          this.panel.webview.postMessage({
            type: "error",
            data: {
              message: `Failed to create to-do: ${(err as Error).message}`,
            },
          });
        }
        break;
      }
      case "loadComments": {
        const { todoId, commentsUrl } = msg.data as {
          todoId: number;
          commentsUrl: string;
        };
        try {
          const comments = await getComments(this.client, commentsUrl);
          this.panel.webview.postMessage({
            type: "comments",
            data: { todoId, comments },
          });
        } catch {
          // silently ignore
        }
        break;
      }
      case "postTodoComment": {
        const { todoId: tid, content: commentContent } = msg.data as {
          todoId: number;
          content: string;
        };
        try {
          const comment = await postComment(
            this.client,
            this.project.id,
            tid,
            commentContent
          );
          this.panel.webview.postMessage({
            type: "commentPosted",
            data: { todoId: tid, comment },
          });
        } catch (err) {
          this.panel.webview.postMessage({
            type: "error",
            data: {
              message: `Failed to post comment: ${(err as Error).message}`,
            },
          });
        }
        break;
      }
    }
  }

  private async loadTodos(): Promise<void> {
    try {
      const [active, completed] = await Promise.all([
        getTodos(this.client, this.todoList.todos_url),
        getTodos(this.client, this.todoList.todos_url, true),
      ]);

      this.panel.webview.postMessage({
        type: "init",
        data: {
          listName: this.todoList.name,
          completedRatio: this.todoList.completed_ratio,
          todos: active,
          completedTodos: completed,
        },
      });
    } catch (err) {
      this.panel.webview.postMessage({
        type: "error",
        data: { message: `Failed to load to-dos: ${(err as Error).message}` },
      });
    }
  }

  private dispose(): void {
    openPanels.delete(`todolist-${this.todoList.id}`);
    this.disposables.forEach((d) => d.dispose());
  }
}
