# Mountaineers MCP Server

[![CI](https://github.com/dreamiurg/mountaineers-mcp/actions/workflows/pr.yml/badge.svg)](https://github.com/dreamiurg/mountaineers-mcp/actions/workflows/pr.yml)
[![npm](https://img.shields.io/npm/v/mountaineers-mcp)](https://www.npmjs.com/package/mountaineers-mcp)

## What is this?

This lets AI assistants like Claude and ChatGPT search and browse [mountaineers.org](https://www.mountaineers.org) on your behalf. Instead of clicking through the website, you can ask questions in plain English:

- *"Find me a beginner-friendly day hike near Seattle this weekend"*
- *"What scrambles are available in August?"*
- *"Show me trip reports for Mount Pilchuck"*
- *"What's the elevation gain on the Mount Si trail?"*
- *"What activities am I signed up for?"*
- *"What badges have I earned?"*

The AI reads the Mountaineers website, understands the results, and gives you a conversational answer -- no manual searching required. Read the full story: [I Built an MCP Server for Mountaineers.org](https://dreamiurg.net/2026/02/06/mountaineers-mcp-server.html).

<p align="center">
  <img src="assets/demo.gif" alt="Mountaineers MCP Server Demo — Claude Code CLI">
</p>

## What can it do?

**Search public data:**
- Search activities by type, branch, difficulty, date, and more
- Search courses, clinics, and seminars
- Browse trip reports
- Search routes and places
- Get full details for any activity, trip report, route, or course

**Access your account:**
- See your upcoming and past activities
- See your completed activity history
- See your course enrollments
- View your earned badges and certifications
- View member profiles and activity rosters

## Setup

> [!IMPORTANT]
> **A one-time login is required for *all* tools, including public search.** mountaineers.org is now behind Cloudflare, which blocks plain HTTP clients — so the server needs a Cloudflare clearance cookie minted by `npm run login` from a local checkout (it opens a real browser once). Do the [Authentication](#authentication) step first; then set up your AI app below. Your mountaineers.org credentials are used only by `npm run login` — **do not** put them in your AI app's config; the server reads the cached cookie, not env vars.

Follow the instructions for your AI app below.

### Claude Desktop

1. Download `mountaineers-mcp-X.Y.Z.mcpb` from the [latest release](https://github.com/dreamiurg/mountaineers-mcp/releases/latest)
2. Open Claude Desktop → **Settings → Extensions → Install Extension**
3. Select the downloaded `.mcpb` file
4. Complete the one-time [Authentication](#authentication) step (`npm run login` from a checkout) — required before any tool will work, since the bundled server reads the cached Cloudflare clearance cookie

<p align="center">
  <img src="assets/claude-desktop-courses.png" width="75%" alt="Course search in Claude Desktop">
</p>

<p align="center">
  <img src="assets/claude-desktop-backpacking.png" width="75%" alt="Backpacking trip details in Claude Desktop">
</p>



That installs the server itself with no Node.js setup -- but you still need to run the one-time [Authentication](#authentication) step (which does require Node.js and a checkout) before any tool works.

<details>
<summary>Manual setup (alternative)</summary>

Requires [Node.js](https://nodejs.org) 18+.

1. Go to **Settings > Developer > Edit Config**
2. Paste this and save:

```json
{
  "mcpServers": {
    "mountaineers": {
      "command": "npx",
      "args": ["-y", "mountaineers-mcp"]
    }
  }
}
```

3. **Quit and reopen** Claude Desktop (not just close the window -- fully quit)

Then complete the [Authentication](#authentication) step. Don't add `MOUNTAINEERS_USERNAME`/`MOUNTAINEERS_PASSWORD` to this config — the server reads the cached Cloudflare clearance cookie, not env vars; credentials are used only by `npm run login`.
</details>

### ChatGPT Desktop

ChatGPT Desktop supports MCP through [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta), but only **remote HTTP servers** -- it cannot run local command-line tools like Claude Desktop can. To use this server with ChatGPT Desktop, you would need to run it behind a tunnel (e.g., [mcp.run](https://mcp.run) or [ngrok](https://ngrok.com)). This is not yet streamlined; we plan to add Streamable HTTP transport in a future release.

> Requires ChatGPT Plus, Pro, Team, or Enterprise.

### Claude Code (CLI)

Run this in your terminal:

```bash
claude mcp add mountaineers -- npx -y mountaineers-mcp
```

Or add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "mountaineers": {
      "command": "npx",
      "args": ["-y", "mountaineers-mcp"]
    }
  }
}
```

Then complete the [Authentication](#authentication) step (credentials go to `npm run login`, not this config).

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.mountaineers]
command = "npx"
args = ["-y", "mountaineers-mcp"]
```

Then complete the [Authentication](#authentication) step (credentials go to `npm run login`, not this config).

Or use the CLI:

```bash
codex mcp add mountaineers -- npx -y mountaineers-mcp
```

## Authentication

Mountaineers.org is protected by Cloudflare, which blocks plain HTTP clients — so **every** tool (public search included) needs a valid Cloudflare clearance cookie, plus a session cookie for account tools. The server doesn't log in itself; it replays cookies minted by the `login` command. Run it once from a local checkout:

```bash
git clone https://github.com/dreamiurg/mountaineers-mcp.git
cd mountaineers-mcp
npm install
MOUNTAINEERS_USERNAME=your-username MOUNTAINEERS_PASSWORD=your-password npm run login
```

This opens a Chromium browser window, navigates to mountaineers.org, solves the Cloudflare challenge automatically, logs in with your credentials, and saves the resulting cookies to a local cache file (`~/.cache/mountaineers-mcp/clearance.json`, or under `$XDG_CACHE_HOME` if set). The MCP server reads the cache on startup, and re-reads it automatically if the clearance expires mid-session — so re-running login takes effect without restarting the server.

**When to re-run:** Cloudflare clearance cookies eventually expire (the exact lifetime is set by Cloudflare and varies). When tools that require login start returning "Cloudflare clearance expired", run `npm run login` again to refresh the cache.

**Requirements:**
- macOS or Linux with a graphical display (the browser window must be visible)
- Node.js 18+ and the repo checked out locally

**Note for `npx` users:** The `npm run login` command is only available from a local checkout. If you installed the server via `npx -y mountaineers-mcp`, you cannot run `login` directly — clone the repo first, run `login` to populate the cache, then go back to your normal `npx`-based setup.

## Tools reference

All tools require the one-time [Authentication](#authentication) setup (Cloudflare gates the whole site). The split below is by the kind of data returned.

### Public data

| Tool | Description |
|------|-------------|
| `search_activities` | Search activities with filters (type, branch, difficulty, date, day of week) |
| `search_courses` | Search courses, clinics, and seminars |
| `search_trip_reports` | Search trip reports by text and activity type |
| `search_routes` | Search routes and places with filters (activity type, difficulty, climbing category) |
| `get_activity` | Get full activity details (leader notes, route, equipment) |
| `get_trip_report` | Get trip report details (conditions, route info) |
| `get_route` | Get route details (difficulty, elevation, directions, maps, related routes) |
| `get_course` | Get course details (schedule, pricing, leaders, badges earned) |

### Your account

| Tool | Description |
|------|-------------|
| `whoami` | Get your name, profile URL, and member slug |
| `get_my_activities` | Your registered activities (upcoming) with filtering |
| `get_my_courses` | Your course enrollments with filtering |
| `get_activity_history` | Your completed activity history with filtering by result, type, and date |
| `get_my_badges` | Your earned badges and certifications with dates |
| `get_member_profile` | View a member's profile, badges, and committees |
| `get_activity_roster` | See who's signed up for an activity |

## Privacy

Your credentials are used only by `npm run login` (passed as environment variables, not persisted) and are sent only to mountaineers.org. What's saved on your computer is the resulting session cookie cache (`~/.cache/mountaineers-mcp/clearance.json`, owner-readable only). Nothing — credentials or cookies — is ever sent to any AI provider or third party.

## Development

```bash
npm install
npm run dev          # Run from TypeScript sources via tsx (no build step)
npm run check        # Typecheck + lint
npm test             # Run tests
npm run ci           # Full CI: check + coverage + build
```

## Other Mountaineering & Outdoors Tools

I climb, scramble, and hike a lot, and I keep building tools around it. If this one's useful to you, the others might be too:

- **[mountaineers-assistant](https://github.com/dreamiurg/mountaineers-assistant)** -- Chrome extension that syncs your mountaineers.org activity history and shows you stats, trends, and climbing partners you can't see on the site.
- **[peakbagger-cli](https://github.com/dreamiurg/peakbagger-cli)** -- Command-line access to PeakBagger.com. Search peaks, check elevation and prominence, browse ascent stats. Outputs JSON for piping into other tools.
- **[claude-mountaineering-skills](https://github.com/dreamiurg/claude-mountaineering-skills)** -- Claude Code plugin that generates route beta reports by pulling conditions, forecasts, and trip reports from multiple mountaineering sites.

## License

MIT
