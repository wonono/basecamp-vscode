import type { DockItem, PaginatedResponse, Project } from "./types.js";

const USER_AGENT = "BasecampVSCode (basecamp-vscode@github.com)";
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export class BasecampClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly dockCache = new Map<number, DockItem[]>();

  constructor(config: { accountId: string; accessToken: string }) {
    this.baseUrl = `https://3.basecampapi.com/${config.accountId}`;
    this.accessToken = config.accessToken;
  }

  async get<T>(path: string): Promise<T> {
    const url = this.resolveUrl(path);
    const response = await this.request("GET", url);
    return response.json() as Promise<T>;
  }

  async getPage<T>(path: string): Promise<PaginatedResponse<T>> {
    const url = this.resolveUrl(path);
    const response = await this.request("GET", url);
    const data = (await response.json()) as T[];
    const nextPageUrl = this.parseNextLink(response.headers.get("link"));
    const totalCountHeader = response.headers.get("x-total-count");
    const totalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : null;
    return { data, nextPageUrl, totalCount };
  }

  async getPaginated<T>(path: string, maxItems?: number): Promise<T[]> {
    const allItems: T[] = [];
    let url: string | null = this.resolveUrl(path);

    while (url) {
      const response = await this.request("GET", url);
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
    const url = this.resolveUrl(path);
    const response = await this.request("POST", url, body);
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const url = this.resolveUrl(path);
    await this.request("DELETE", url);
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
      throw new Error(
        `Dock "${dockName}" not found or not enabled for project ${projectId}`
      );
    }
    return dock.url;
  }

  private resolveUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith("https://")) {
      return pathOrUrl;
    }
    return `${this.baseUrl}${pathOrUrl}`;
  }

  private async request(
    method: string,
    url: string,
    body?: unknown,
    retryCount = 0
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "User-Agent": USER_AGENT,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json; charset=utf-8";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error("Rate limit exceeded after maximum retries");
      }
      const retryAfter = parseInt(
        response.headers.get("retry-after") || "5",
        10
      );
      console.error(
        `Rate limited. Retrying after ${retryAfter}s (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      await this.sleep(retryAfter * 1000);
      return this.request(method, url, body, retryCount + 1);
    }

    if (response.status >= 500) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Server error ${response.status} after maximum retries`);
      }
      const backoff = BACKOFF_BASE_MS * Math.pow(2, retryCount);
      console.error(
        `Server error ${response.status}. Retrying in ${backoff}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      await this.sleep(backoff);
      return this.request(method, url, body, retryCount + 1);
    }

    if (response.status === 404) {
      const reason = response.headers.get("reason");
      throw new Error(
        reason
          ? `Not found: ${reason}`
          : `Resource not found: ${url}`
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Basecamp API error ${response.status}: ${response.statusText}. ${text}`
      );
    }

    return response;
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
