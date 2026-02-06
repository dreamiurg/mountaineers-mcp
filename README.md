# mountaineers-mcp

[![CI](https://github.com/dreamiurg/mountaineers-mcp/actions/workflows/pr.yml/badge.svg)](https://github.com/dreamiurg/mountaineers-mcp/actions/workflows/pr.yml)
[![codecov](https://codecov.io/gh/dreamiurg/mountaineers-mcp/graph/badge.svg)](https://codecov.io/gh/dreamiurg/mountaineers-mcp)

> MCP server for [The Mountaineers](https://www.mountaineers.org) - search activities, trip reports, courses, and access your member profile.

## Installation

```bash
npm install
npm run build
```

## Usage

Add to your Claude Code `.mcp.json`:

```json
{
  "mcpServers": {
    "mountaineers": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/mountaineers-mcp",
      "env": {
        "MOUNTAINEERS_USERNAME": "your-username",
        "MOUNTAINEERS_PASSWORD": "your-password"
      }
    }
  }
}
```

## Tools

### Public (no auth required)

| Tool | Description |
|------|-------------|
| `search_activities` | Search activities with filters (type, branch, difficulty, date, day of week) |
| `search_courses` | Search courses, clinics, and seminars |
| `search_trip_reports` | Search trip reports by text and activity type |
| `get_activity` | Get full activity details (leader notes, route, equipment) |
| `get_trip_report` | Get trip report details (author, conditions, route info) |

### Authenticated

| Tool | Description |
|------|-------------|
| `whoami` | Get current user's name, slug, and profile URL |
| `get_member_profile` | Get a member's profile, badges, and committees |
| `get_activity_roster` | Get participant roster for an activity |
| `get_my_activities` | Get your activity history (default: last 20, sorted by date) |
| `get_my_courses` | Get your course history |

## Development

```bash
npm run dev          # Start with tsx (auto-reload)
npm run check        # Typecheck + lint
npm test             # Run tests
npm run ci           # Full CI: check + coverage + build
```

## License

MIT
