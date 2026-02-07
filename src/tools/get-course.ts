import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import { parseCourseDetail } from "../parsers.js";
import type { CourseDetail } from "../types.js";

export const getCourseSchema = z.object({
  url: z
    .string()
    .describe("Full course URL or course slug (e.g. 'basic-climbing-course-seattle-2025')"),
});

export type GetCourseInput = z.infer<typeof getCourseSchema>;

export async function getCourse(
  client: MountaineersClient,
  input: GetCourseInput,
): Promise<CourseDetail> {
  const url = input.url.startsWith("http")
    ? input.url
    : `${client.baseUrl}/courses/courses-clinics-seminars/${input.url}`;

  const $ = await client.fetchHtml(url);
  return parseCourseDetail($, url);
}
