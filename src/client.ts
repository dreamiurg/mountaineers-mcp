import * as cheerio from "cheerio";
import { type Clearance, loadClearance } from "./clearance.js";

const BASE_URL = "https://www.mountaineers.org";
const RATE_LIMIT_MS = 500;

export class MountaineersClient {
  private clearance: Clearance | null;
  private lastRequestTime = 0;

  constructor() {
    this.clearance = loadClearance();
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private ensureClearance(): void {
    if (!this.clearance) {
      throw new Error("No Cloudflare clearance found. Run `npm run login` to authenticate.");
    }
  }

  private cookieHeader(): string {
    if (!this.clearance) return "";
    return this.clearance.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  private isChallenge(response: Response): boolean {
    return response.status === 403 && response.headers.get("cf-mitigated") === "challenge";
  }

  async fetchRaw(
    url: string,
    options: { headers?: Record<string, string> } = {},
  ): Promise<Response> {
    this.ensureClearance();

    const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
    const send = () => {
      const headers: Record<string, string> = {
        "User-Agent": this.clearance!.userAgent,
        Cookie: this.cookieHeader(),
        ...options.headers,
      };
      return fetch(fullUrl, { headers, redirect: "follow" });
    };

    await this.rateLimit();
    let response = await send();

    if (this.isChallenge(response)) {
      await response.body?.cancel(); // release the socket; do not read the body
      this.clearance = loadClearance();
      if (!this.clearance) {
        throw new Error("No Cloudflare clearance found. Run `npm run login` to authenticate.");
      }
      await this.rateLimit();
      response = await send();
      if (this.isChallenge(response)) {
        await response.body?.cancel();
        throw new Error("Cloudflare clearance expired. Run `npm run login` to re-authenticate.");
      }
    }

    return response;
  }

  async fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
    const response = await this.fetchRaw(url, {
      headers: { Accept: "text/html" },
    });
    const html = await response.text();
    return cheerio.load(html);
  }

  async fetchFacetedQuery(basePath: string, params: URLSearchParams): Promise<cheerio.CheerioAPI> {
    const url = `${basePath}/@@faceted_query?${params.toString()}`;
    const response = await this.fetchRaw(url, {
      headers: {
        Accept: "text/html",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const html = await response.text();
    return cheerio.load(html);
  }

  async fetchJson<T = unknown>(url: string): Promise<T> {
    const response = await this.fetchRaw(url, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    return (await response.json()) as T;
  }

  async fetchRosterTab(activityUrl: string): Promise<cheerio.CheerioAPI> {
    const url = activityUrl.endsWith("/")
      ? `${activityUrl}roster-tab`
      : `${activityUrl}/roster-tab`;
    const response = await this.fetchRaw(url, {
      headers: {
        Accept: "text/html",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const html = await response.text();
    return cheerio.load(html);
  }

  get baseUrl(): string {
    return BASE_URL;
  }
}
