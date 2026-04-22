import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseMemberCourses } from "../parsers.js";
import type { ListResult, MyCourse } from "../types.js";
import { normalizeMemberSlug } from "./_member-history-shared.js";

export const getMemberCoursesSchema = z.object({
  member: z
    .string()
    .describe("Member slug (e.g. 'jane-doe'), /members/{slug} path, or full profile URL"),
  status: z.string().optional().describe("Filter by status: 'Registered', 'Waitlisted', etc."),
  role: z.string().optional().describe("Filter by role: 'Student', 'Instructor', etc."),
  result: z.string().optional().describe("Filter by result: 'Successful', 'Canceled', etc."),
  date_from: z.string().optional().describe("Filter courses enrolled from this date (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("Filter courses enrolled to this date (YYYY-MM-DD)"),
  limit: z
    .number()
    .optional()
    .describe("Max number of results to return (default 20, use 0 for all)"),
});

export type GetMemberCoursesInput = z.infer<typeof getMemberCoursesSchema>;

export async function getMemberCourses(
  client: MountaineersClient,
  input: GetMemberCoursesInput,
): Promise<ListResult<MyCourse>> {
  const slug = normalizeMemberSlug(input.member);

  const $ = await client.fetchHtml(`/members/${slug}/member-courses`, {
    authenticated: true,
  });

  let courses = parseMemberCourses($);

  courses.sort((a, b) => {
    if (!a.enrolled_date && !b.enrolled_date) return 0;
    if (!a.enrolled_date) return 1;
    if (!b.enrolled_date) return -1;
    return a.enrolled_date.localeCompare(b.enrolled_date);
  });

  if (input.status) {
    const status = input.status;
    courses = courses.filter((c) => c.status?.toLowerCase() === status.toLowerCase());
  }
  if (input.role) {
    const role = input.role;
    courses = courses.filter((c) => c.role?.toLowerCase() === role.toLowerCase());
  }
  if (input.result) {
    const result = input.result;
    courses = courses.filter((c) => c.result?.toLowerCase() === result.toLowerCase());
  }
  if (input.date_from) {
    const dateFrom = input.date_from;
    courses = courses.filter((c) => c.enrolled_date && c.enrolled_date >= dateFrom);
  }
  if (input.date_to) {
    const dateTo = input.date_to;
    courses = courses.filter((c) => c.enrolled_date && c.enrolled_date <= dateTo);
  }

  const totalCount = courses.length;
  const limit = input.limit ?? 20;
  if (limit > 0) {
    courses = courses.slice(0, limit);
  }

  return { total_count: totalCount, items: courses, limit };
}
