import * as cheerio from "cheerio";
import { Impit, type ImpitResponse } from "impit";
import { type Clearance, loadClearance } from "./clearance.js";

const BASE_URL = "https://www.mountaineers.org";
const RATE_LIMIT_MS = 500;

export class MountaineersClient {
  private clearance: Clearance | null;
  private lastRequestTime = 0;
  // Cloudflare binds cf_clearance to the client's TLS/HTTP-2 fingerprint, so a
  // plain `fetch`/`curl` is rejected even with a valid cookie. Impit impersonates
  // Chrome's TLS+headers, which lets the replayed cf_clearance pass the challenge.
  private readonly impit = new Impit({ browser: "chrome" });

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
    return this.clearance!.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  private isChallenge(response: ImpitResponse): boolean {
    return response.status === 403 && response.headers.get("cf-mitigated") === "challenge";
  }

  async fetchRaw(
    url: string,
    options: { headers?: Record<string, string> } = {},
  ): Promise<ImpitResponse> {
    this.ensureClearance();

    const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
    // Only inject cookies; let Impit own the User-Agent so it stays consistent
    // with the Chrome TLS fingerprint it presents (a mismatched UA can re-trip CF).
    const send = () => {
      const headers: Record<string, string> = {
        Cookie: this.cookieHeader(),
        ...options.headers,
      };
      return this.impit.fetch(fullUrl, { headers, redirect: "follow" });
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
