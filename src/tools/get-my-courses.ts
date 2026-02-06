import { z } from "zod";
import type { MountaineersClient } from "../client.js";
import type { MyActivity } from "../types.js";
import { getMyActivities } from "./get-my-activities.js";

export const getMyCoursesSchema = z.object({
  result: z
    .string()
    .optional()
    .describe("Filter by result: 'Successful', 'Canceled', etc."),
  date_from: z
    .string()
    .optional()
    .describe("Filter courses from this date (YYYY-MM-DD)"),
  date_to: z
    .string()
    .optional()
    .describe("Filter courses to this date (YYYY-MM-DD)"),
});

export type GetMyCoursesInput = z.infer<typeof getMyCoursesSchema>;

export async function getMyCourses(
  client: MountaineersClient,
  input: GetMyCoursesInput
): Promise<MyActivity[]> {
  return getMyActivities(client, {
    category: "course",
    result: input.result,
    date_from: input.date_from,
    date_to: input.date_to,
  });
}
