import * as cheerio from "cheerio";
import { Impit, type ImpitResponse } from "impit";
import { type Clearance, loadClearance } from "./clearance.js";

const BASE_URL = "https://www.mountaineers.org";
const RATE_LIMIT_MS = 500;
const NO_CLEARANCE_MSG = "No Cloudflare clearance found. Run `npm run login` to authenticate.";
const CLEARANCE_EXPIRED_MSG =
  "Cloudflare clearance expired. Run `npm run login` to re-authenticate.";

function cookieString(clearance: Clearance): string {
  return clearance.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

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

  private ensureClearance(): Clearance {
    if (!this.clearance) throw new Error(NO_CLEARANCE_MSG);
    return this.clearance;
  }

  private async discard(response: ImpitResponse): Promise<void> {
    try {
      await response.body?.cancel();
    } catch {
      /* body already consumed/errored — nothing to release */
    }
  }

  private isChallenge(response: ImpitResponse): boolean {
    return response.status === 403 && response.headers.get("cf-mitigated") === "challenge";
  }

  async fetchRaw(
    url: string,
    options: { headers?: Record<string, string> } = {},
  ): Promise<ImpitResponse> {
    let clearance = this.ensureClearance();
    const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
    // Only inject cookies; let Impit own the User-Agent so it stays consistent
    // with the Chrome TLS fingerprint it presents (a mismatched UA can re-trip CF).
    const send = () =>
      this.impit.fetch(fullUrl, {
        headers: { ...options.headers, Cookie: cookieString(clearance) },
        redirect: "follow",
      });

    await this.rateLimit();
    let response = await send();

    if (this.isChallenge(response)) {
      await this.discard(response);
      const reloaded = loadClearance();
      if (!reloaded) throw new Error(NO_CLEARANCE_MSG);
      this.clearance = reloaded;
      clearance = reloaded;
      await this.rateLimit();
      response = await send();
      if (this.isChallenge(response)) {
        await this.discard(response);
        throw new Error(CLEARANCE_EXPIRED_MSG);
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
    const url = `${activityUrl.replace(/\/?$/, "/")}roster-tab`;
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
