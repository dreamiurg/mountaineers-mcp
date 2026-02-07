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

The AI reads the Mountaineers website, understands the results, and gives you a conversational answer -- no manual searching required.

## What can it do?

**Search the website** (no login needed):
- Search activities by type, branch, difficulty, date, and more
- Search courses, clinics, and seminars
- Browse trip reports
- Search routes and places
- Get full details for any activity, trip report, route, or course

**Access your account** (with your login):
- See your upcoming and past activities
- See your completed activity history
- See your course enrollments
- View your earned badges and certifications
- View member profiles and activity rosters

## Setup

Follow the instructions for your AI app below.

### Claude Desktop

1. Download `mountaineers-mcp-X.Y.Z.mcpb` from the [latest release](https://github.com/dreamiurg/mountaineers-mcp/releases/latest)
2. Open Claude Desktop → **Settings → Extensions → Install Extension**
3. Select the downloaded `.mcpb` file
4. Enter your mountaineers.org credentials if you want account access (optional)

That's it -- no Node.js install required.

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

To also access your account (activity history, rosters, etc.), add your mountaineers.org credentials:

```json
{
  "mcpServers": {
    "mountaineers": {
      "command": "npx",
      "args": ["-y", "mountaineers-mcp"],
      "env": {
        "MOUNTAINEERS_USERNAME": "your-username",
        "MOUNTAINEERS_PASSWORD": "your-password"
      }
    }
  }
}
```

Your credentials stay on your computer and are only sent to mountaineers.org.
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
      "args": ["-y", "mountaineers-mcp"],
      "env": {
        "MOUNTAINEERS_USERNAME": "your-username",
        "MOUNTAINEERS_PASSWORD": "your-password"
      }
    }
  }
}
```

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.mountaineers]
command = "npx"
args = ["-y", "mountaineers-mcp"]

[mcp_servers.mountaineers.env]
MOUNTAINEERS_USERNAME = "your-username"
MOUNTAINEERS_PASSWORD = "your-password"
```

Or use the CLI:

```bash
codex mcp add mountaineers -- npx -y mountaineers-mcp
```

## Tools reference

### Public (no login required)

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

### Authenticated (login required)

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

Your credentials are stored locally on your computer and are only sent to mountaineers.org to log in. They are never sent to any AI provider or third party.

## Development

```bash
npm install
npm run dev          # Start with auto-reload
npm run check        # Typecheck + lint
npm test             # Run tests
npm run ci           # Full CI: check + coverage + build
```

## License

MIT
