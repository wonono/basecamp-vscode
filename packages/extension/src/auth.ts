import * as vscode from "vscode";
import * as http from "http";
import * as crypto from "crypto";
import type { AuthTokens } from "./api/types";

const SECRETS_KEY = "basecamp-auth";
const TOKEN_ENDPOINT = "https://launchpad.37signals.com/authorization/token";
const AUTH_ENDPOINT = "https://launchpad.37signals.com/authorization/new";
const AUTH_INFO_ENDPOINT = "https://launchpad.37signals.com/authorization.json";
const OAUTH_TIMEOUT_MS = 120_000;
const OAUTH_PORT = 21437;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`;

export class AuthManager implements vscode.Disposable {
  private readonly secrets: vscode.SecretStorage;
  private cachedTokens: AuthTokens | undefined;
  private refreshPromise: Promise<void> | null = null;

  private readonly _onDidChangeAuth = new vscode.EventEmitter<void>();
  readonly onDidChangeAuth = this._onDidChangeAuth.event;

  constructor(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  dispose(): void {
    this._onDidChangeAuth.dispose();
  }

  get isAuthenticated(): boolean {
    return this.cachedTokens !== undefined;
  }

  async initialize(): Promise<void> {
    const raw = await this.secrets.get(SECRETS_KEY);
    if (raw) {
      try {
        this.cachedTokens = JSON.parse(raw) as AuthTokens;
      } catch {
        this.cachedTokens = undefined;
      }
    }
  }

  async getTokens(): Promise<AuthTokens> {
    if (!this.cachedTokens) {
      throw new Error("Not authenticated. Please sign in first.");
    }
    await this.refreshIfNeeded();
    return this.cachedTokens;
  }

  async signIn(): Promise<void> {
    const config = vscode.workspace.getConfiguration("basecamp");
    const clientId = config.get<string>("clientId");
    const clientSecret = config.get<string>("clientSecret");

    if (!clientId || !clientSecret) {
      const action = await vscode.window.showErrorMessage(
        "Basecamp OAuth credentials not configured. Please set basecamp.clientId and basecamp.clientSecret in settings.",
        "Open Settings"
      );
      if (action === "Open Settings") {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "basecamp.clientId"
        );
      }
      return;
    }

    const { code, redirectUri } = await this.startOAuthFlow(clientId);

    // Exchange code for tokens
    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        type: "web_server",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${text}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Fetch account info to get account_id
    const authInfoResponse = await fetch(AUTH_INFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "BasecampVSCode (basecamp-vscode@github.com)",
      },
    });

    if (!authInfoResponse.ok) {
      throw new Error("Failed to fetch account info");
    }

    const authInfo = (await authInfoResponse.json()) as {
      accounts: Array<{ id: number; product: string; href: string; name: string }>;
    };

    // Use the first Basecamp 4 (bc3) account
    const account = authInfo.accounts.find(
      (a) => a.product === "bc3" || a.href.includes("3.basecampapi.com")
    ) ?? authInfo.accounts[0];

    if (!account) {
      throw new Error("No Basecamp accounts found");
    }

    const tokens: AuthTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString(),
      account_id: String(account.id),
    };

    await this.storeTokens(tokens);
    vscode.window.showInformationMessage(
      `Signed in to Basecamp: ${account.name}`
    );
  }

  async signOut(): Promise<void> {
    this.cachedTokens = undefined;
    await this.secrets.delete(SECRETS_KEY);
    this._onDidChangeAuth.fire();
    vscode.window.showInformationMessage("Signed out of Basecamp.");
  }

  private async startOAuthFlow(
    clientId: string
  ): Promise<{ code: string; redirectUri: string }> {
    return new Promise((resolve, reject) => {
      const state = crypto.randomBytes(32).toString("hex");
      let resolved = false;

      const server = http.createServer((req, res) => {
        if (!req.url?.startsWith("/callback")) {
          res.writeHead(404);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost`);
        const receivedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Authentication failed</h1><p>You can close this window.</p></body></html>");
          cleanup();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (receivedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Invalid state parameter</h1></body></html>");
          cleanup();
          reject(new Error("OAuth state mismatch (possible CSRF)"));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Missing authorization code</h1></body></html>");
          cleanup();
          reject(new Error("Missing authorization code"));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Authenticated!</h1><p>You can close this window and return to VSCode.</p></body></html>");

        resolved = true;
        cleanup();
        resolve({ code, redirectUri: REDIRECT_URI });
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error("OAuth flow timed out"));
        }
      }, OAUTH_TIMEOUT_MS);

      function cleanup() {
        clearTimeout(timeout);
        server.close();
      }

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          cleanup();
          reject(
            new Error(
              `Port ${OAUTH_PORT} is already in use. Close the application using it and try again.`
            )
          );
        } else {
          cleanup();
          reject(err);
        }
      });

      server.listen(OAUTH_PORT, () => {
        const authUrl =
          `${AUTH_ENDPOINT}?type=web_server&client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&state=${encodeURIComponent(state)}`;

        vscode.env.openExternal(vscode.Uri.parse(authUrl));
      });
    });
  }

  private async refreshIfNeeded(): Promise<void> {
    if (!this.cachedTokens) return;

    const expiresAt = new Date(this.cachedTokens.expires_at).getTime();
    const bufferMs = 60_000;
    if (Date.now() < expiresAt - bufferMs) return;

    // Mutex: only one refresh at a time
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = this.doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<void> {
    const config = vscode.workspace.getConfiguration("basecamp");
    const clientId = config.get<string>("clientId");
    const clientSecret = config.get<string>("clientSecret");

    if (!clientId || !clientSecret || !this.cachedTokens) {
      return;
    }

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        type: "refresh",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.cachedTokens.refresh_token,
      }),
    });

    if (!response.ok) {
      // Refresh failed — force re-authentication
      this.cachedTokens = undefined;
      await this.secrets.delete(SECRETS_KEY);
      this._onDidChangeAuth.fire();
      vscode.window.showWarningMessage(
        "Basecamp session expired. Please sign in again."
      );
      return;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const tokens: AuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? this.cachedTokens.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      account_id: this.cachedTokens.account_id,
    };

    await this.storeTokens(tokens);
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    this.cachedTokens = tokens;
    await this.secrets.store(SECRETS_KEY, JSON.stringify(tokens));
    this._onDidChangeAuth.fire();
  }
}
