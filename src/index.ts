import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MountaineersClient } from "./client.js";
import {
  searchActivitiesSchema,
  searchActivities,
} from "./tools/search-activities.js";
import {
  searchCoursesSchema,
  searchCourses,
} from "./tools/search-courses.js";
import {
  searchTripReportsSchema,
  searchTripReports,
} from "./tools/search-trip-reports.js";
import { getActivitySchema, getActivity } from "./tools/get-activity.js";
import {
  getTripReportSchema,
  getTripReport,
} from "./tools/get-trip-report.js";
import { whoami } from "./tools/whoami.js";
import {
  getMyActivitiesSchema,
  getMyActivities,
} from "./tools/get-my-activities.js";
import {
  getMyCoursesSchema,
  getMyCourses,
} from "./tools/get-my-courses.js";
import {
  getMemberProfileSchema,
  getMemberProfile,
} from "./tools/get-member-profile.js";
import {
  getActivityRosterSchema,
  getActivityRoster,
} from "./tools/get-activity-roster.js";

const client = new MountaineersClient();

const server = new McpServer({
  name: "mountaineers",
  version: "0.1.0",
});

function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// Public tools

server.tool(
  "search_activities",
  "Search for outdoor activities on mountaineers.org. Supports filtering by type, branch, difficulty, date range, and more.",
  searchActivitiesSchema.shape,
  async (input) => {
    try {
      const result = await searchActivities(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "search_courses",
  "Search for courses, clinics, and seminars on mountaineers.org.",
  searchCoursesSchema.shape,
  async (input) => {
    try {
      const result = await searchCourses(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "search_trip_reports",
  "Search trip reports on mountaineers.org.",
  searchTripReportsSchema.shape,
  async (input) => {
    try {
      const result = await searchTripReports(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_activity",
  "Get detailed information about a specific activity by URL or slug.",
  getActivitySchema.shape,
  async (input) => {
    try {
      const result = await getActivity(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_trip_report",
  "Get detailed information about a specific trip report by URL or slug.",
  getTripReportSchema.shape,
  async (input) => {
    try {
      const result = await getTripReport(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Authenticated tools

server.tool(
  "whoami",
  "Get the currently logged-in user's name, slug, and profile URL. Requires MOUNTAINEERS_USERNAME and MOUNTAINEERS_PASSWORD env vars.",
  {},
  async () => {
    try {
      const result = await whoami(client);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_my_activities",
  "Get the logged-in user's activity history. Supports filtering by category (trip/course), result, and date range.",
  getMyActivitiesSchema.shape,
  async (input) => {
    try {
      const result = await getMyActivities(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_my_courses",
  "Get the logged-in user's course history. Supports filtering by result and date range.",
  getMyCoursesSchema.shape,
  async (input) => {
    try {
      const result = await getMyCourses(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_member_profile",
  "Get a member's profile information including name, branch, committees, and badges. Requires authentication.",
  getMemberProfileSchema.shape,
  async (input) => {
    try {
      const result = await getMemberProfile(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_activity_roster",
  "Get the participant roster for a specific activity. Requires authentication.",
  getActivityRosterSchema.shape,
  async (input) => {
    try {
      const result = await getActivityRoster(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mountaineers MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
