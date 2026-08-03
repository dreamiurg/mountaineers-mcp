import * as cheerio from "cheerio";
import type { Impit as ImpitClass, ImpitResponse } from "impit";
import { type Clearance, loadClearance } from "./clearance.js";

const BASE_URL = "https://www.mountaineers.org";
const RATE_LIMIT_MS = 500;
const NO_CLEARANCE_MSG = "Not signed in to mountaineers.org. Run the `login` tool to authenticate.";
const CLEARANCE_EXPIRED_MSG =
  "Your mountaineers.org session expired. Run the `login` tool to re-authenticate.";
const NATIVE_BINDING_MSG =
  "Failed to load the impit native bindings, which this server needs to reach mountaineers.org. " +
  `This usually means the build does not match your platform (${process.platform}-${process.arch}) — ` +
  "reinstall the extension/package built for it.";
// A protected page served to a logged-out client is replaced by the login form
// rather than an error status, so it parses to empty fields instead of failing.
const LOGIN_FORM_MARKER = 'name="__ac_name"';
// A faceted response is either a result list or Plone's explicit empty-folder
// notice. Anything else (challenge interstitial, login page, error shell) means
// we did not get real search results and must not report it as zero hits.
const FACETED_RESULT_MARKER = "faceted-result-count";
const FACETED_EMPTY_MARKER = "no items in this folder";

function cookieString(clearance: Clearance): string {
  return clearance.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export class MountaineersClient {
  private clearance: Clearance | null;
  private lastRequestTime = 0;
  // Cloudflare binds cf_clearance to the client's TLS/HTTP-2 fingerprint, so a
  // plain `fetch`/`curl` is rejected even with a valid cookie. Impit impersonates
  // Chrome's TLS+headers, which lets the replayed cf_clearance pass the challenge.
  private impit: ImpitClass | null = null;

  constructor() {
    this.clearance = loadClearance();
  }

  // impit is a native module, and importing it throws outright when no prebuilt
  // binding matches the host platform. Loading it on first use rather than at
  // module scope keeps the server able to start and answer with a readable
  // error: a module-scope throw kills the process before MCP framing exists, so
  // the client only ever sees the transport close with no diagnostics at all.
  private async getImpit(): Promise<ImpitClass> {
    if (!this.impit) {
      try {
        const { Impit } = await import("impit");
        this.impit = new Impit({ browser: "chrome" });
      } catch (cause) {
        throw new Error(NATIVE_BINDING_MSG, { cause });
      }
    }
    return this.impit;
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
    // The single client instance is constructed at server startup. If the server
    // started before the user authenticated, the constructor saw no cache. The
    // `login` tool writes the clearance from a separate process, so re-read from
    // disk here before giving up — otherwise a fresh login wouldn't take effect
    // until the server was restarted.
    if (!this.clearance) this.clearance = loadClearance();
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

  private async ensureOk(response: ImpitResponse, url: string): Promise<void> {
    if (!response.ok) {
      await this.discard(response);
      throw new Error(`HTTP ${response.status} fetching ${url}`);
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
    const impit = await this.getImpit();
    const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
    // Only inject cookies; let Impit own the User-Agent so it stays consistent
    // with the Chrome TLS fingerprint it presents (a mismatched UA can re-trip CF).
    const send = () =>
      impit.fetch(fullUrl, {
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
      // No rateLimit() here: this is a single immediate retry of the request we
      // just made; the initial rateLimit() already spaced it from other calls.
      response = await send();
      if (this.isChallenge(response)) {
        await this.discard(response);
        throw new Error(CLEARANCE_EXPIRED_MSG);
      }
    }
    return response;
  }

  // Every HTML path funnels through here so that a logged-out response fails
  // loudly once, instead of each parser independently returning empty fields.
  private async loadHtml(response: ImpitResponse, url: string): Promise<string> {
    await this.ensureOk(response, url);
    const html = await response.text();
    if (html.includes(LOGIN_FORM_MARKER)) throw new Error(CLEARANCE_EXPIRED_MSG);
    return html;
  }

  async fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
    const response = await this.fetchRaw(url, {
      headers: { Accept: "text/html" },
    });
    return cheerio.load(await this.loadHtml(response, url));
  }

  async fetchFacetedQuery(basePath: string, params: URLSearchParams): Promise<cheerio.CheerioAPI> {
    const url = `${basePath}/@@faceted_query?${params.toString()}`;
    const response = await this.fetchRaw(url, {
      headers: {
        Accept: "text/html",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const html = await this.loadHtml(response, url);
    // Distinguish "the search really matched nothing" from "we were not served
    // search results at all". Only the latter is an error; conflating them is
    // what let a whole session report zero climbs without a single warning.
    if (!html.includes(FACETED_RESULT_MARKER) && !html.includes(FACETED_EMPTY_MARKER)) {
      throw new Error(
        `Unrecognized response from ${url} — expected search results but got neither a result ` +
          "count nor an empty-result notice. The session may have expired; try the `login` tool.",
      );
    }
    return cheerio.load(html);
  }

  async fetchJson<T = unknown>(url: string): Promise<T> {
    const response = await this.fetchRaw(url, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    await this.ensureOk(response, url);
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
    return cheerio.load(await this.loadHtml(response, url));
  }

  get baseUrl(): string {
    return BASE_URL;
  }
}
