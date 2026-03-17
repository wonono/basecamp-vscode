import * as vscode from "vscode";
import type { BasecampContentProvider } from "./basecampContentProvider";

export class BasecampCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private readonly contentProvider: BasecampContentProvider) {}

  notifyChange(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const uri = document.uri;
    const meta = this.contentProvider.getMeta(uri);
    if (!meta) return [];

    const lenses: vscode.CodeLens[] = [];
    const topRange = new vscode.Range(0, 0, 0, 0);

    // Common actions at the top
    lenses.push(
      new vscode.CodeLens(topRange, {
        title: "$(sync) Refresh",
        command: "basecamp.md.refreshDoc",
        arguments: [uri],
      })
    );

    if (meta.appUrl) {
      lenses.push(
        new vscode.CodeLens(topRange, {
          title: "$(link-external) Open in Basecamp",
          command: "basecamp.md.openInBrowser",
          arguments: [meta.appUrl],
        })
      );
    }

    lenses.push(
      new vscode.CodeLens(topRange, {
        title: "$(window) Rich View",
        command: "basecamp.md.richView",
        arguments: [uri, meta],
      })
    );

    if (meta.type === "message") {
      lenses.push(
        new vscode.CodeLens(topRange, {
          title: "$(comment) Add Comment",
          command: "basecamp.md.addComment",
          arguments: [uri, meta.projectId, meta.messageId],
        })
      );
    }

    if (meta.type === "todolist") {
      lenses.push(
        new vscode.CodeLens(topRange, {
          title: "$(add) Add To-do",
          command: "basecamp.md.addTodo",
          arguments: [uri, meta.projectId, meta.entityId],
        })
      );

      // Per-todo CodeLens
      for (const [lineNum, todoInfo] of meta.todoLines) {
        if (lineNum >= document.lineCount) continue;
        const range = new vscode.Range(lineNum, 0, lineNum, 0);

        if (todoInfo.completed) {
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(circle-outline) Undo",
              command: "basecamp.md.uncompleteTodo",
              arguments: [uri, meta.projectId, todoInfo.id],
            })
          );
        } else {
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(pass-filled) Complete",
              command: "basecamp.md.completeTodo",
              arguments: [uri, meta.projectId, todoInfo.id],
            })
          );
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(comment) Comment",
              command: "basecamp.md.addComment",
              arguments: [uri, meta.projectId, todoInfo.id],
            })
          );
        }
      }
    }

    return lenses;
  }
}
