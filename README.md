# Mountaineers MCP Server

[![CI](https://github.com/dreamiurg/mountaineers-mcp/actions/workflows/pr.yml/badge.svg)](https://github.com/dreamiurg/mountaineers-mcp/actions/workflows/pr.yml)
[![npm](https://img.shields.io/npm/v/mountaineers-mcp)](https://www.npmjs.com/package/mountaineers-mcp)

## What is this?

This lets AI assistants like Claude search and browse [mountaineers.org](https://www.mountaineers.org) on your behalf. Instead of clicking through the website, you can ask questions in plain English:

- *"Find me a beginner-friendly day hike near Seattle this weekend"*
- *"What scrambles are available in August?"*
- *"Show me trip reports for Mount Pilchuck"*
- *"What activities am I signed up for?"*

The AI reads the Mountaineers website, understands the results, and gives you a conversational answer -- no manual searching required.

## What can it do?

**Search the website** (no login needed):
- Search activities by type, branch, difficulty, date, and more
- Search courses, clinics, and seminars
- Browse trip reports
- Get full details for any activity or trip report

**Access your account** (with your login):
- See your upcoming and past activities
- See your course history
- View member profiles and activity rosters

## Quick setup

You need [Node.js](https://nodejs.org) 18 or later installed on your computer.

### Claude Desktop

Open **Settings > Developer > Edit Config** and add:

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

To use features that require login, add your mountaineers.org credentials:

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

### VS Code / Cursor

Add to your `.vscode/mcp.json` (or global settings):

```json
{
  "servers": {
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

### Claude Code (CLI)

Add to your `.mcp.json`:

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

## Tools reference

### Public (no login required)

| Tool | Description |
|------|-------------|
| `search_activities` | Search activities with filters (type, branch, difficulty, date, day of week) |
| `search_courses` | Search courses, clinics, and seminars |
| `search_trip_reports` | Search trip reports by text and activity type |
| `get_activity` | Get full activity details (leader notes, route, equipment) |
| `get_trip_report` | Get trip report details (conditions, route info) |

### Authenticated (login required)

| Tool | Description |
|------|-------------|
| `whoami` | Get your name, profile URL, and member slug |
| `get_my_activities` | Your activity history with filtering by date and result |
| `get_my_courses` | Your course history with filtering |
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
