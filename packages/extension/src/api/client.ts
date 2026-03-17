import type { DockItem, Project } from "./types";

const USER_AGENT = "BasecampVSCode (basecamp-vscode@github.com)";
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

interface CacheEntry {
  etag: string;
  data: unknown;
}

export type TokenProvider = () => Promise<{
  accessToken: string;
  accountId: string;
}>;

export type OnAuthError = () => Promise<void>;

export class BasecampClient {
  private readonly getToken: TokenProvider;
  private readonly onAuthError?: OnAuthError;
  private readonly etagCache = new Map<string, CacheEntry>();
  private readonly dockCache = new Map<number, DockItem[]>();

  constructor(getToken: TokenProvider, onAuthError?: OnAuthError) {
    this.getToken = getToken;
    this.onAuthError = onAuthError;
  }

  async get<T>(path: string): Promise<T> {
    const { accessToken, accountId } = await this.getToken();
    const url = this.resolveUrl(path, accountId);
    const response = await this.request("GET", url, accessToken);
    return response.json() as Promise<T>;
  }

  async getWithEtag<T>(path: string): Promise<{ data: T; changed: boolean }> {
    const { accessToken, accountId } = await this.getToken();
    const url = this.resolveUrl(path, accountId);
    const cached = this.etagCache.get(url);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    };
    if (cached?.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    const response = await this.rawRequest("GET", url, headers);

    if (response.status === 304 && cached) {
      return { data: cached.data as T, changed: false };
    }

    if (response.status === 401 && this.onAuthError) {
      await this.onAuthError();
      return this.getWithEtag<T>(path);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response, url);
    }

    const data = (await response.json()) as T;
    const etag = response.headers.get("etag");
    if (etag) {
      this.etagCache.set(url, { etag, data });
    }
    return { data, changed: true };
  }

  async getPaginated<T>(path: string, maxItems?: number): Promise<T[]> {
    const { accessToken, accountId } = await this.getToken();
    const allItems: T[] = [];
    let url: string | null = this.resolveUrl(path, accountId);

    while (url) {
      const response = await this.request("GET", url, accessToken);
      const items = (await response.json()) as T[];
      allItems.push(...items);

      if (maxItems && allItems.length >= maxItems) {
        return allItems.slice(0, maxItems);
      }

      url = this.parseNextLink(response.headers.get("link"));
    }

    return allItems;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const { accessToken, accountId } = await this.getToken();
    const url = this.resolveUrl(path, accountId);
    const response = await this.request("POST", url, accessToken, body);
    this.invalidateCache(url);
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const { accessToken, accountId } = await this.getToken();
    const url = this.resolveUrl(path, accountId);
    const response = await this.request("PUT", url, accessToken, body);
    this.invalidateCache(url);
    return response.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const { accessToken, accountId } = await this.getToken();
    const url = this.resolveUrl(path, accountId);
    await this.request("DELETE", url, accessToken);
    this.invalidateCache(url);
  }

  async getDockUrl(projectId: number, dockName: string): Promise<string> {
    let docks = this.dockCache.get(projectId);
    if (!docks) {
      const project = await this.get<Project>(`/projects/${projectId}.json`);
      docks = project.dock;
      this.dockCache.set(projectId, docks);
    }
    const dock = docks.find((d) => d.name === dockName && d.enabled);
    if (!dock) {
      throw new Error(`Dock "${dockName}" not found or not enabled for project ${projectId}`);
    }
    return dock.url;
  }

  clearCache(): void {
    this.etagCache.clear();
    this.dockCache.clear();
  }

  private resolveUrl(pathOrUrl: string, accountId: string): string {
    if (pathOrUrl.startsWith("https://")) {
      return pathOrUrl;
    }
    return `https://3.basecampapi.com/${accountId}${pathOrUrl}`;
  }

  private invalidateCache(url: string): void {
    // Invalidate the exact URL and its parent collection
    this.etagCache.delete(url);
    const parentUrl = url.replace(/\/[^/]+\.json$/, ".json");
    if (parentUrl !== url) {
      this.etagCache.delete(parentUrl);
    }
  }

  private async request(
    method: string,
    url: string,
    accessToken: string,
    body?: unknown,
    retryCount = 0
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json; charset=utf-8";
    }

    const response = await this.rawRequest(method, url, headers, body);

    if (response.status === 401 && this.onAuthError && retryCount === 0) {
      await this.onAuthError();
      const newTokens = await this.getToken();
      return this.request(method, url, newTokens.accessToken, body, 1);
    }

    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error("Rate limit exceeded after maximum retries");
      }
      const retryAfter = parseInt(response.headers.get("retry-after") || "5", 10);
      await this.sleep(retryAfter * 1000);
      return this.request(method, url, accessToken, body, retryCount + 1);
    }

    if (response.status >= 500) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Server error ${response.status} after maximum retries`);
      }
      const backoff = BACKOFF_BASE_MS * Math.pow(2, retryCount);
      await this.sleep(backoff);
      return this.request(method, url, accessToken, body, retryCount + 1);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response, url);
    }

    return response;
  }

  private async rawRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<Response> {
    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  private async handleErrorResponse(response: Response, url: string): Promise<never> {
    if (response.status === 404) {
      const reason = response.headers.get("reason");
      throw new Error(reason ? `Not found: ${reason}` : `Resource not found: ${url}`);
    }
    const text = await response.text().catch(() => "");
    throw new Error(`Basecamp API error ${response.status}: ${response.statusText}. ${text}`);
  }

  private parseNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1] : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
