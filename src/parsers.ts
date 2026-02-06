import type { CheerioAPI } from "cheerio";
import type {
  ActivitySummary,
  ActivityDetail,
  CourseSummary,
  TripReportSummary,
  TripReportDetail,
  MemberProfile,
  RosterEntry,
  SearchResult,
} from "./types.js";

const BASE_URL = "https://www.mountaineers.org";

function text(el: ReturnType<CheerioAPI>, selector?: string): string | null {
  const target = selector ? el.find(selector) : el;
  const t = target.text().trim();
  return t || null;
}

function href(
  el: ReturnType<CheerioAPI>,
  selector: string
): string | null {
  const raw = el.find(selector).attr("href");
  if (!raw) return null;
  return raw.startsWith("http") ? raw : `${BASE_URL}${raw}`;
}

function parseResultCount($: CheerioAPI): number {
  const countText = $("#faceted-result-count, .faceted-result-count")
    .text()
    .trim();
  const match = countText.match(/(\d[\d,]*)/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
}

export function parseActivityResults(
  $: CheerioAPI,
  page: number
): SearchResult<ActivitySummary> {
  const totalCount = parseResultCount($);
  const items: ActivitySummary[] = [];

  $(".result-item").each((_i, el) => {
    const $el = $(el);
    items.push({
      title: text($el, ".result-title a") ?? "",
      url: href($el, ".result-title a") ?? "",
      type: text($el, ".result-type"),
      date: text($el, ".result-date"),
      difficulty: text($el, ".result-difficulty"),
      availability: text($el, ".result-availability"),
      branch: text($el, ".result-branch"),
      leader: text($el, ".result-leader a"),
      leader_url: href($el, ".result-leader a"),
      description: text($el, ".result-summary"),
      prerequisites: text($el, ".result-prereqs"),
    });
  });

  return {
    total_count: totalCount,
    items,
    page,
    has_more: (page + 1) * 20 < totalCount,
  };
}

export function parseActivityDetail(
  $: CheerioAPI,
  url: string
): ActivityDetail {
  const detail: ActivityDetail = {
    title: $("h1").first().text().trim(),
    url,
    type: $("h2").first().text().trim() || null,
    date: null,
    end_date: null,
    committee: null,
    activity_type: null,
    audience: null,
    difficulty: null,
    mileage: null,
    elevation_gain: null,
    availability: null,
    registration_open: null,
    registration_close: null,
    branch: null,
    leader: null,
    leader_url: null,
    leader_notes: null,
    meeting_place: null,
    route_place: null,
    required_equipment: null,
    prerequisites: null,
  };

  // Parse metadata from details list
  $("ul.details li, .activity-details li, .details-list li").each((_i, el) => {
    const $el = $(el);
    const label = $el.find("strong, .label, dt").text().trim().toLowerCase();
    const value =
      $el
        .clone()
        .children("strong, .label, dt")
        .remove()
        .end()
        .text()
        .trim() || null;

    if (label.includes("date") && !label.includes("registration")) {
      if (!detail.date) detail.date = value;
      else detail.end_date = value;
    } else if (label.includes("committee")) detail.committee = value;
    else if (label.includes("activity type")) detail.activity_type = value;
    else if (label.includes("audience")) detail.audience = value;
    else if (label.includes("difficulty")) detail.difficulty = value;
    else if (label.includes("mileage") || label.includes("distance"))
      detail.mileage = value;
    else if (label.includes("elevation")) detail.elevation_gain = value;
    else if (label.includes("availability")) detail.availability = value;
    else if (label.includes("registration open"))
      detail.registration_open = value;
    else if (label.includes("registration close"))
      detail.registration_close = value;
    else if (label.includes("branch")) detail.branch = value;
    else if (label.includes("prerequisite")) detail.prerequisites = value;
  });

  // Leader info
  const leaderEl = $(".leader-info a, .contacts a, .activity-leader a").first();
  if (leaderEl.length) {
    detail.leader = leaderEl.text().trim() || null;
    const leaderHref = leaderEl.attr("href");
    detail.leader_url = leaderHref
      ? leaderHref.startsWith("http")
        ? leaderHref
        : `${BASE_URL}${leaderHref}`
      : null;
  }

  // Text content sections
  detail.leader_notes =
    $(".leader-notes, #leader-notes")
      .text()
      .trim() || null;
  detail.meeting_place =
    $(".meeting-place, #meeting-place")
      .text()
      .trim() || null;
  detail.route_place =
    $(".route-place, #route-place, #route-tab")
      .text()
      .trim() || null;
  detail.required_equipment =
    $(".required-equipment, #required-equipment")
      .text()
      .trim() || null;

  return detail;
}

export function parseCourseResults(
  $: CheerioAPI,
  page: number
): SearchResult<CourseSummary> {
  const totalCount = parseResultCount($);
  const items: CourseSummary[] = [];

  $(".result-item").each((_i, el) => {
    const $el = $(el);
    items.push({
      title: text($el, ".result-title a") ?? "",
      url: href($el, ".result-title a") ?? "",
      date: text($el, ".result-date"),
      prerequisites: text($el, ".result-prereqs"),
      availability: text($el, ".result-availability"),
      branch: text($el, ".result-branch"),
      leader: text($el, ".result-leader a"),
      leader_url: href($el, ".result-leader a"),
      description: text($el, ".result-summary"),
    });
  });

  return {
    total_count: totalCount,
    items,
    page,
    has_more: (page + 1) * 20 < totalCount,
  };
}

export function parseTripReportResults(
  $: CheerioAPI,
  page: number
): SearchResult<TripReportSummary> {
  const totalCount = parseResultCount($);
  const items: TripReportSummary[] = [];

  $(".result-item").each((_i, el) => {
    const $el = $(el);
    items.push({
      title: text($el, ".result-title a") ?? "",
      url: href($el, ".result-title a") ?? "",
      date: text($el, ".result-date"),
      author: text($el, ".result-author, .result-leader a"),
      activity_type: text($el, ".result-type"),
      trip_result: text($el, ".result-trip-result"),
      description: text($el, ".result-summary"),
    });
  });

  return {
    total_count: totalCount,
    items,
    page,
    has_more: (page + 1) * 20 < totalCount,
  };
}

export function parseTripReportDetail(
  $: CheerioAPI,
  url: string
): TripReportDetail {
  return {
    title: $("h1").first().text().trim(),
    url,
    date:
      $(".trip-report-date, .documentPublished, .result-date")
        .text()
        .trim() || null,
    author:
      $(".trip-report-author a, .documentAuthor a")
        .first()
        .text()
        .trim() || null,
    activity_type:
      $(".trip-report-type, .activity-type").text().trim() || null,
    trip_result:
      $(".trip-report-result, .trip-result").text().trim() || null,
    route: $(".trip-report-route, .route").text().trim() || null,
    body:
      $(
        ".trip-report-body, .trip-report-text, #parent-fieldname-text, .documentDescription"
      )
        .text()
        .trim() || null,
    related_activity_url: href(
      $("body") as unknown as ReturnType<CheerioAPI>,
      ".related-activity a, .trip-report-activity a"
    ),
  };
}

export function parseRoster($: CheerioAPI): RosterEntry[] {
  const entries: RosterEntry[] = [];

  $(".roster-contact").each((_i, el) => {
    const $el = $(el);
    const link = $el.find("a.contact-modal, a[href*='/members/']").first();
    const nameEl = $el.find(".roster-name, .contact-name, a").first();
    const roleEl = $el.find(".roster-position");
    const avatarEl = $el.find("img");

    entries.push({
      name: nameEl.text().trim() || "Unknown",
      profile_url: link.attr("href")
        ? link.attr("href")!.startsWith("http")
          ? link.attr("href")!
          : `${BASE_URL}${link.attr("href")!}`
        : null,
      role: roleEl.text().trim() || null,
      avatar: avatarEl.attr("src") || null,
    });
  });

  return entries;
}

export function parseMemberProfile(
  $: CheerioAPI,
  url: string
): MemberProfile {
  const profile: MemberProfile = {
    name: $("h1").first().text().trim(),
    url,
    member_since: null,
    branch: null,
    email: null,
    committees: [],
    badges: [],
  };

  // Parse details
  $(".profile-wrapper .details li, .member-details li").each((_i, el) => {
    const t = $(el).text().trim().toLowerCase();
    if (t.includes("member since")) {
      profile.member_since = t.replace(/member since:?\s*/i, "").trim() || null;
    } else if (t.includes("branch")) {
      profile.branch = t.replace(/branch:?\s*/i, "").trim() || null;
    }
  });

  // Email
  profile.email =
    $(".email a, a[href^='mailto:']")
      .first()
      .text()
      .trim() || null;

  // Committees
  $(".profile-committees li a, .committees li a").each((_i, el) => {
    const name = $(el).text().trim();
    if (name) profile.committees.push(name);
  });

  // Badges
  $(".profile-badges .badge a, .badges .badge a").each((_i, el) => {
    const $el = $(el);
    const name = $el.text().trim();
    const titleAttr = $el.attr("title") || "";
    let earned: string | null = null;
    let expires: string | null = null;

    const earnedMatch = titleAttr.match(/earned:?\s*([^,;]+)/i);
    if (earnedMatch) earned = earnedMatch[1].trim();
    const expiresMatch = titleAttr.match(/expires:?\s*([^,;]+)/i);
    if (expiresMatch) expires = expiresMatch[1].trim();

    if (name) profile.badges.push({ name, earned, expires });
  });

  return profile;
}
