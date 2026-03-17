import * as vscode from "vscode";

interface PollTarget {
  key: string;
  fetchFn: () => Promise<unknown>;
  intervalMs: number;
  lastPollAt: number;
  callback: (data: unknown) => void;
}

const TICK_INTERVAL_MS = 5_000;

export class PollingService implements vscode.Disposable {
  private readonly targets = new Map<string, PollTarget>();
  private tickTimer: NodeJS.Timeout | undefined;
  private paused = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.window.onDidChangeWindowState((state) => {
        this.paused = !state.focused;
      })
    );
  }

  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  subscribe(
    key: string,
    fetchFn: () => Promise<unknown>,
    intervalMs: number,
    callback: (data: unknown) => void
  ): vscode.Disposable {
    this.targets.set(key, {
      key,
      fetchFn,
      intervalMs,
      lastPollAt: 0,
      callback,
    });

    if (!this.tickTimer) {
      this.start();
    }

    return new vscode.Disposable(() => {
      this.targets.delete(key);
      if (this.targets.size === 0) {
        this.stop();
      }
    });
  }

  unsubscribe(key: string): void {
    this.targets.delete(key);
    if (this.targets.size === 0) {
      this.stop();
    }
  }

  private async tick(): Promise<void> {
    if (this.paused) return;

    const now = Date.now();
    for (const target of this.targets.values()) {
      if (now - target.lastPollAt >= target.intervalMs) {
        target.lastPollAt = now;
        try {
          const data = await target.fetchFn();
          target.callback(data);
        } catch (err) {
          console.error(`Polling error for "${target.key}":`, err);
        }
      }
    }
  }

  dispose(): void {
    this.stop();
    this.targets.clear();
    this.disposables.forEach((d) => d.dispose());
  }
}
