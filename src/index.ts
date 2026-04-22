#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MountaineersClient } from "./client.js";
import { getActivity, getActivitySchema } from "./tools/get-activity.js";
import { getActivityHistory, getActivityHistorySchema } from "./tools/get-activity-history.js";
import { getActivityRoster, getActivityRosterSchema } from "./tools/get-activity-roster.js";
import { getCourse, getCourseSchema } from "./tools/get-course.js";
import { getEvent, getEventSchema } from "./tools/get-event.js";
import { getMemberActivities, getMemberActivitiesSchema } from "./tools/get-member-activities.js";
import { getMemberCourses, getMemberCoursesSchema } from "./tools/get-member-courses.js";
import { getMemberHistory, getMemberHistorySchema } from "./tools/get-member-history.js";
import { getMemberProfile, getMemberProfileSchema } from "./tools/get-member-profile.js";
import { getMyActivities, getMyActivitiesSchema } from "./tools/get-my-activities.js";
import { getMyBadges, getMyBadgesSchema } from "./tools/get-my-badges.js";
import { getMyCourses, getMyCoursesSchema } from "./tools/get-my-courses.js";
import { getRoute, getRouteSchema } from "./tools/get-route.js";
import { getRouteTripReports, getRouteTripReportsSchema } from "./tools/get-route-trip-reports.js";
import { getTripReport, getTripReportSchema } from "./tools/get-trip-report.js";
import { listBranches, listBranchesSchema } from "./tools/list-branches.js";
import { listCommittees, listCommitteesSchema } from "./tools/list-committees.js";
import { searchActivities, searchActivitiesSchema } from "./tools/search-activities.js";
import { searchCourses, searchCoursesSchema } from "./tools/search-courses.js";
import { searchEvents, searchEventsSchema } from "./tools/search-events.js";
import { searchMembers, searchMembersSchema } from "./tools/search-members.js";
import { searchRoutes, searchRoutesSchema } from "./tools/search-routes.js";
import { searchTripReports, searchTripReportsSchema } from "./tools/search-trip-reports.js";
import { whoami } from "./tools/whoami.js";

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
  "Search currently-published outdoor activities on mountaineers.org (upcoming trips, course field trips, clinics). Supports filtering by type, branch, difficulty, date range, and more. Past activity instances are NOT in the search index — if you have a known historical activity URL use get_activity, or use get_member_history for a member's past activities.",
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
  },
);

server.tool(
  "search_courses",
  "Search currently-published courses, clinics, and seminars on mountaineers.org (upcoming and rolling-enrollment only). Past course instances (prior years) are NOT in the search index, even though their URLs still resolve — if you have a known historical course URL use get_course, or use get_my_courses for the authenticated user's past courses.",
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
  },
);

server.tool(
  "search_trip_reports",
  "Search trip reports on mountaineers.org. Trip reports are member-written accounts of past outings; the full historical archive (8000+ reports) is searchable here. To narrow to a specific route, pass the route name as the query.",
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
  },
);

server.tool(
  "get_route_trip_reports",
  "List trip reports filed against a specific route/place URL. Paginated, 20 per page; results follow the site's default order (typically newest first). Use this when you have a route URL and want member-written reports for that route specifically — more accurate than searching trip reports by route name.",
  getRouteTripReportsSchema.shape,
  async (input) => {
    try {
      const result = await getRouteTripReports(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "search_routes",
  "Search routes and places on mountaineers.org. Filter by activity type, difficulty, climbing category, and more.",
  searchRoutesSchema.shape,
  async (input) => {
    try {
      const result = await searchRoutes(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "search_events",
  "Search mountaineers.org events (festivals, clinics, social gatherings, branch meetings — distinct from activities and courses). Returns title, URL, date string, and location. Optionally filter by free-text query.",
  searchEventsSchema.shape,
  async (input) => {
    try {
      const result = await searchEvents(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
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
  },
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
  },
);

server.tool(
  "get_route",
  "Get detailed information about a specific route or place on mountaineers.org, including difficulty, elevation, directions, and maps.",
  getRouteSchema.shape,
  async (input) => {
    try {
      const result = await getRoute(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_course",
  "Get detailed information about a specific course, including schedule, pricing, leaders, and badges earned.",
  getCourseSchema.shape,
  async (input) => {
    try {
      const result = await getCourse(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_event",
  "Get detailed information about a specific mountaineers.org event by URL: title, description, date/time string, committee, branch, body text, and any additional event-specific fields (expected attendance, contacts, custom Q&A).",
  getEventSchema.shape,
  async (input) => {
    try {
      const result = await getEvent(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "list_branches",
  "List all mountaineers.org branches (e.g. Seattle, Tacoma, Olympia). Returns slug + display name + URL. Use the slug as input to list_committees.",
  listBranchesSchema.shape,
  async (input) => {
    try {
      const result = await listBranches(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "list_committees",
  "List all committees for a given branch (e.g. 'seattle-branch'). Returns slug + name + URL.",
  listCommitteesSchema.shape,
  async (input) => {
    try {
      const result = await listCommittees(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
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
  },
);

server.tool(
  "get_my_activities",
  "Get the logged-in user's registered activities (upcoming and past). Supports filtering by category, status, result, and date range.",
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
  },
);

server.tool(
  "get_my_courses",
  "Get the logged-in user's course enrollments (current and past). Supports filtering by status, role, result, and date range.",
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
  },
);

server.tool(
  "get_activity_history",
  "Get the logged-in user's completed activity history (past trips, courses, events). Supports filtering by category, result, activity type, and date range. For arbitrary members use get_member_history.",
  getActivityHistorySchema.shape,
  async (input) => {
    try {
      const result = await getActivityHistory(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_my_badges",
  "Get the logged-in user's earned badges and certifications. Supports filtering by name and active status.",
  getMyBadgesSchema.shape,
  async (input) => {
    try {
      const result = await getMyBadges(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
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
  },
);

server.tool(
  "get_activity_roster",
  "Get the participant roster for a specific activity by URL or slug. Requires authentication.",
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
  },
);

server.tool(
  "search_members",
  "Search the mountaineers.org member directory by name or text. Returns name + slug + profile URL. The directory includes both individual members and group/role accounts (e.g. committee mailboxes); both are returned with no type marker. Requires authentication and a non-empty query.",
  searchMembersSchema.shape,
  async (input) => {
    try {
      const result = await searchMembers(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_member_history",
  "Get the past activity history for any mountaineers.org member, given their slug or profile URL. Returns completed activities only (not future-registered). Same filters as get_activity_history (which is the self-only version). Requires authentication.",
  getMemberHistorySchema.shape,
  async (input) => {
    try {
      const result = await getMemberHistory(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_member_courses",
  "Get a member's courses (upcoming + past, merged into one list ordered by enrolled date ascending), given their slug or profile URL. Mirrors get_my_courses for any member. Requires authentication.",
  getMemberCoursesSchema.shape,
  async (input) => {
    try {
      const result = await getMemberCourses(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_member_activities",
  "Get a member's upcoming/registered activities by slug or profile URL. Returns activities the member is currently signed up for — for past completed activities use get_member_history. Mirrors get_my_activities for any member. Requires authentication.",
  getMemberActivitiesSchema.shape,
  async (input) => {
    try {
      const result = await getMemberActivities(client, input);
      return { content: [{ type: "text", text: formatResult(result) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
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
