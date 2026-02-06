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
  const t = target.text().trim().replace(/\s+/g, " ");
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
    title:
      $("h1.documentFirstHeading").text().trim() ||
      $("h1").first().text().trim(),
    url,
    type: $("h2.kicker").text().trim() || null,
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

  // Parse metadata from ul.details li elements
  // Fields use either <label> or <strong> as the field name prefix
  $(".program-core ul.details li, ul.details li").each((_i, el) => {
    const $el = $(el);
    const labelEl = $el.find("label, strong").first();
    const label = labelEl.text().trim().toLowerCase().replace(/:$/, "");

    if (!label) {
      // First li without a label is typically the date
      const plainText = $el.text().trim();
      if (plainText && !detail.date) {
        detail.date = plainText;
        return;
      }
    }

    // Extract value: clone, remove label/strong elements, get remaining text
    const value =
      $el.clone().children("label, strong").remove().end().text().trim().replace(/\s+/g, " ") ||
      null;

    // Also check for link text (e.g. committee links)
    const linkText = $el.find("a").first().text().trim();

    if (label.includes("committee"))
      detail.committee = linkText || value;
    else if (label.includes("activity type")) detail.activity_type = value;
    else if (label.includes("audience")) detail.audience = value;
    else if (label.includes("difficulty")) detail.difficulty = value;
    else if (label.includes("leader rating")) {
      /* skip - not in our model */
    } else if (label.includes("mileage") || label.includes("distance"))
      detail.mileage = value;
    else if (label.includes("elevation gain")) detail.elevation_gain = value;
    else if (label.includes("availability") && !label.includes("assistant"))
      detail.availability = value;
    else if (label.includes("registration open"))
      detail.registration_open = value;
    else if (label.includes("registration close"))
      detail.registration_close = value;
    else if (label.includes("branch")) detail.branch = value;
    else if (label.includes("prerequisite")) detail.prerequisites = value;
  });

  // Leader info from .leaders .roster-contact
  const leaderContact = $(".leaders .roster-contact").first();
  if (leaderContact.length) {
    // Try img alt attribute first (most reliable)
    const imgEl = leaderContact.find("img").first();
    if (imgEl.length) {
      detail.leader = imgEl.attr("alt")?.trim() || null;
    }
    // Fallback: find div that isn't .roster-position
    if (!detail.leader) {
      leaderContact.find("div").each((_i, el) => {
        const $div = $(el);
        if (!$div.hasClass("roster-position") && !detail.leader) {
          const t = $div.text().trim();
          if (t) detail.leader = t;
        }
      });
    }
    // URL from img src which contains /members/slug/
    const imgSrc = imgEl?.attr("src") || "";
    const memberMatch = imgSrc.match(/\/members\/([^/]+)/);
    if (memberMatch) {
      detail.leader_url = `${BASE_URL}/members/${memberMatch[1]}`;
    }
    // Or from an explicit link
    const leaderLink = leaderContact.find("a[href*='/members/']").first();
    if (leaderLink.length) {
      const leaderHref = leaderLink.attr("href")!;
      detail.leader_url = leaderHref.startsWith("http")
        ? leaderHref
        : `${BASE_URL}${leaderHref}`;
    }
  }

  // Text content sections from .content-text div > label
  $(".content-text > div").each((_i, el) => {
    const $div = $(el);
    const sectionLabel = $div.find("> label").text().trim().toLowerCase();
    // Get content after the label
    const content = $div.clone().children("label").remove().end().text().trim();
    if (!content) return;

    if (sectionLabel.includes("leader") && sectionLabel.includes("note"))
      detail.leader_notes = content;
    else if (sectionLabel.includes("meeting"))
      detail.meeting_place = content;
  });

  // Tabs content
  $(".tabs .tab").each((_i, el) => {
    const $tab = $(el);
    const tabTitle = $tab.find(".tab-title").text().trim().toLowerCase();
    const tabContent = $tab.find(".tab-content").text().trim();
    if (!tabContent) return;

    if (tabTitle.includes("route") || tabTitle.includes("place"))
      detail.route_place = tabContent;
    else if (tabTitle.includes("equipment"))
      detail.required_equipment = tabContent;
  });

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
    let author: string | null = null;
    let activity_type: string | null = null;
    let trip_result: string | null = null;

    // Sidebar items use plain divs with <label> children
    $el.find(".result-sidebar > div").each((_j, sidebarEl) => {
      const $div = $(sidebarEl);
      const label = $div.find("label").text().trim().toLowerCase();
      const value = $div.clone().children("label").remove().end().text().trim();
      if (!value) return;

      if (label.includes("by")) author = value;
      else if (label.includes("activity type")) activity_type = value;
      else if (label.includes("trip result")) trip_result = value;
    });

    items.push({
      title: text($el, ".result-title a") ?? "",
      url: href($el, ".result-title a") ?? "",
      date: text($el, ".result-date"),
      author,
      activity_type,
      trip_result,
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
  const detail: TripReportDetail = {
    title:
      $("h1.documentFirstHeading").text().trim() ||
      $("h1").first().text().trim(),
    url,
    date: null,
    author: null,
    activity_type: null,
    trip_result: null,
    route: null,
    body: $("p.documentDescription").text().trim() || null,
    related_activity_url: null,
  };

  // Author from header metadata
  const authorEl = $(".tripreport-metadata span.author a.name");
  if (authorEl.length) {
    // Text content includes img alt text, so get only direct text nodes
    detail.author = authorEl.contents().filter(function () {
      return this.type === "text";
    }).text().trim() || authorEl.text().trim();
  }

  // Publish date from header metadata
  detail.date = $(".tripreport-metadata .pubdate").text().trim() || null;

  // Details from ul.details li > label
  $(".program-core ul.details li").each((_i, el) => {
    const $el = $(el);
    const labelEl = $el.find("label").first();
    const label = labelEl.text().trim().toLowerCase().replace(/:?\s*$/, "");

    const value =
      $el.clone().children("label").remove().end().text().trim() || null;

    if (label.includes("date") && !detail.date) detail.date = value;
    else if (label.includes("route") || label.includes("place")) {
      const linkText = $el.find("a").first().text().trim();
      detail.route = linkText || value;
      const routeHref = $el.find("a").first().attr("href");
      if (routeHref) {
        detail.related_activity_url = routeHref.startsWith("http")
          ? routeHref
          : `${BASE_URL}${routeHref}`;
      }
    } else if (label.includes("activity type")) detail.activity_type = value;
    else if (label.includes("trip result")) detail.trip_result = value;
  });

  return detail;
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
  // Name: use documentFirstHeading, skip generic "Profile" h1, fallback to title tag
  let name =
    $("h1.documentFirstHeading").text().trim() || "";
  if (!name || name.toLowerCase() === "profile") {
    // Try second h1
    const h1s = $("h1");
    h1s.each((_i, el) => {
      const t = $(el).text().trim();
      if (t && t.toLowerCase() !== "profile") {
        name = t;
        return false;
      }
    });
  }
  if (!name || name.toLowerCase() === "profile") {
    // Fallback to title tag: "Name — The Mountaineers"
    const title = $("title").text().trim();
    const titleMatch = title.match(/^(.+?)\s*[—–-]\s*/);
    if (titleMatch) name = titleMatch[1].trim();
  }

  const profile: MemberProfile = {
    name,
    url,
    member_since: null,
    branch: null,
    email: null,
    committees: [],
    badges: [],
  };

  // Parse details from ul.details li - text format: "Label: Value"
  $("ul.details li").each((_i, el) => {
    const $el = $(el);
    const fullText = $el.text().trim();

    if (fullText.toLowerCase().startsWith("member since")) {
      const match = fullText.match(/member since:\s*(.+)/i);
      if (match) profile.member_since = match[1].trim();
    } else if (fullText.toLowerCase().startsWith("branch")) {
      // Branch has a link child with the branch name
      const linkText = $el.find("a").text().trim();
      if (linkText) profile.branch = linkText;
      else {
        const match = fullText.match(/branch:\s*(.+)/i);
        if (match) profile.branch = match[1].trim();
      }
    }
  });

  // Email: use .email container's mailto link (not the sharing mailto)
  const emailLink = $(".email a[href^='mailto:']").first();
  if (emailLink.length) {
    profile.email = emailLink.text().trim() || null;
  }

  // Committees
  $(".profile-committees li a, .committees li a").each((_i, el) => {
    const cname = $(el).text().trim();
    if (cname) profile.committees.push(cname);
  });

  // Badges
  $(".profile-badges .badge a, .badges .badge a, .badge-list .badge a").each((_i, el) => {
    const $el = $(el);
    const bname = $el.text().trim();
    const titleAttr = $el.attr("title") || "";
    let earned: string | null = null;
    let expires: string | null = null;

    const earnedMatch = titleAttr.match(/earned:?\s*([^,;]+)/i);
    if (earnedMatch) earned = earnedMatch[1].trim();
    const expiresMatch = titleAttr.match(/expires:?\s*([^,;]+)/i);
    if (expiresMatch) expires = expiresMatch[1].trim();

    if (bname) profile.badges.push({ name: bname, earned, expires });
  });

  return profile;
}
