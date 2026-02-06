import * as cheerio from "cheerio";

const BASE_URL = "https://www.mountaineers.org";
const RATE_LIMIT_MS = 500;

export class MountaineersClient {
  private cookies: string[] = [];
  private loggedIn = false;
  private lastRequestTime = 0;
  private username: string | undefined;
  private password: string | undefined;

  constructor() {
    this.username = process.env.MOUNTAINEERS_USERNAME;
    this.password = process.env.MOUNTAINEERS_PASSWORD;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_MS - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private buildCookieHeader(): string {
    return this.cookies.join("; ");
  }

  private captureCookies(response: Response): void {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      const nameValue = sc.split(";")[0];
      if (!nameValue) continue;
      const name = nameValue.split("=")[0];
      // Replace existing cookie with same name or add new
      this.cookies = this.cookies.filter((c) => !c.startsWith(name + "="));
      this.cookies.push(nameValue);
    }
  }

  async login(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error(
        "MOUNTAINEERS_USERNAME and MOUNTAINEERS_PASSWORD environment variables required"
      );
    }

    await this.rateLimit();

    // Step 1: GET login page to capture cookies and _authenticator token
    const loginPageRes = await fetch(`${BASE_URL}/login`, {
      redirect: "manual",
      headers: { "User-Agent": "MountaineersMCP/0.1.0" },
    });
    this.captureCookies(loginPageRes);
    const loginHtml = await loginPageRes.text();

    // Extract CSRF _authenticator token
    const authMatch = loginHtml.match(
      /name="_authenticator"\s+value="([^"]*)"/
    );

    await this.rateLimit();

    // Step 2: POST login form with correct Plone field names
    const formData = new URLSearchParams();
    formData.append("__ac_name", this.username);
    formData.append("__ac_password", this.password);
    formData.append("came_from", "");
    if (authMatch) formData.append("_authenticator", authMatch[1]);
    formData.append("buttons.login", "Log in");

    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.buildCookieHeader(),
        "User-Agent": "MountaineersMCP/0.1.0",
      },
      body: formData.toString(),
      redirect: "manual",
    });
    this.captureCookies(loginRes);

    // Follow redirect if any
    const location = loginRes.headers.get("location");
    if (location) {
      await this.rateLimit();
      const followRes = await fetch(
        location.startsWith("http") ? location : `${BASE_URL}${location}`,
        {
          headers: {
            Cookie: this.buildCookieHeader(),
            "User-Agent": "MountaineersMCP/0.1.0",
          },
          redirect: "manual",
        }
      );
      this.captureCookies(followRes);
    }

    this.loggedIn = true;
  }

  async ensureLoggedIn(): Promise<void> {
    if (!this.loggedIn) {
      await this.login();
    }
  }

  async fetchRaw(
    url: string,
    options: {
      headers?: Record<string, string>;
      authenticated?: boolean;
    } = {}
  ): Promise<Response> {
    if (options.authenticated) {
      await this.ensureLoggedIn();
    }

    await this.rateLimit();

    const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
    const headers: Record<string, string> = {
      "User-Agent": "MountaineersMCP/0.1.0",
      ...options.headers,
    };

    if (this.cookies.length > 0) {
      headers["Cookie"] = this.buildCookieHeader();
    }

    const response = await fetch(fullUrl, { headers, redirect: "follow" });
    this.captureCookies(response);
    return response;
  }

  async fetchHtml(
    url: string,
    options: { authenticated?: boolean } = {}
  ): Promise<cheerio.CheerioAPI> {
    const response = await this.fetchRaw(url, {
      headers: { Accept: "text/html" },
      authenticated: options.authenticated,
    });
    const html = await response.text();
    return cheerio.load(html);
  }

  async fetchFacetedQuery(
    basePath: string,
    params: URLSearchParams
  ): Promise<cheerio.CheerioAPI> {
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

  async fetchJson<T = unknown>(
    url: string,
    options: { authenticated?: boolean } = {}
  ): Promise<T> {
    const response = await this.fetchRaw(url, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      authenticated: options.authenticated,
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
      authenticated: true,
    });
    const html = await response.text();
    return cheerio.load(html);
  }

  get baseUrl(): string {
    return BASE_URL;
  }

  get isLoggedIn(): boolean {
    return this.loggedIn;
  }

  get hasCredentials(): boolean {
    return !!(this.username && this.password);
  }
}
