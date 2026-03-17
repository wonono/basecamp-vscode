import * as vscode from "vscode";

export class BadgeService {
  private readonly counts = new Map<string, number>();
  private treeView: vscode.TreeView<unknown> | undefined;

  setTreeView(treeView: vscode.TreeView<unknown>): void {
    this.treeView = treeView;
  }

  increment(key: string, amount = 1): void {
    const current = this.counts.get(key) ?? 0;
    this.counts.set(key, current + amount);
    this.updateBadge();
  }

  reset(key: string): void {
    this.counts.delete(key);
    this.updateBadge();
  }

  resetAll(): void {
    this.counts.clear();
    this.updateBadge();
  }

  private updateBadge(): void {
    if (!this.treeView) return;
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    this.treeView.badge =
      total > 0
        ? { value: total, tooltip: `${total} unread item(s)` }
        : undefined;
  }
}
