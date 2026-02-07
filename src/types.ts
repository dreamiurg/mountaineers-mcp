// Data models for Mountaineers MCP server

export interface ActivitySummary {
  title: string;
  url: string;
  type: string | null;
  date: string | null;
  difficulty: string | null;
  availability: string | null;
  branch: string | null;
  leader: string | null;
  leader_url: string | null;
  description: string | null;
  prerequisites: string | null;
}

export interface ActivityDetail {
  title: string;
  url: string;
  type: string | null;
  date: string | null;
  end_date: string | null;
  committee: string | null;
  activity_type: string | null;
  audience: string | null;
  difficulty: string | null;
  mileage: string | null;
  elevation_gain: string | null;
  availability: string | null;
  registration_open: string | null;
  registration_close: string | null;
  branch: string | null;
  leader: string | null;
  leader_url: string | null;
  leaders: { name: string; url: string | null; role: string | null }[];
  leader_notes: string | null;
  meeting_place: string | null;
  route_place: string | null;
  required_equipment: string | null;
  prerequisites: string | null;
}

export interface CourseSummary {
  title: string;
  url: string;
  date: string | null;
  prerequisites: string | null;
  availability: string | null;
  branch: string | null;
  leader: string | null;
  leader_url: string | null;
  description: string | null;
}

export interface TripReportSummary {
  title: string;
  url: string;
  date: string | null;
  author: string | null;
  activity_type: string | null;
  trip_result: string | null;
  description: string | null;
}

export interface TripReportDetail {
  title: string;
  url: string;
  date: string | null;
  author: string | null;
  activity_type: string | null;
  trip_result: string | null;
  route: string | null;
  body: string | null;
  related_activity_url: string | null;
}

export interface MyActivity {
  uid: string;
  title: string;
  url: string;
  category: string | null;
  activity_type: string | null;
  start_date: string | null;
  leader: string | null;
  is_leader: boolean;
  position: string | null;
  status: string | null;
  result: string | null;
  difficulty: string | null;
  leader_rating: string | null;
}

export interface MemberProfile {
  name: string;
  url: string;
  member_since: string | null;
  branch: string | null;
  email: string | null;
  committees: string[];
  badges: Badge[];
}

export interface Badge {
  name: string;
  earned: string | null;
  expires: string | null;
}

export interface RosterEntry {
  name: string;
  profile_url: string | null;
  role: string | null;
  avatar: string | null;
}

export interface MyCourse {
  title: string;
  url: string;
  enrolled_date: string | null;
  good_through: string | null;
  role: string | null;
  status: string | null;
  result: string | null;
}

export interface RouteDetail {
  title: string;
  url: string;
  description: string | null;
  suitable_activities: string | null;
  seasons: string | null;
  difficulty: string | null;
  length: string | null;
  elevation_gain: string | null;
  high_point: string | null;
  land_manager: string | null;
  parking_permit: string | null;
  recommended_party_size: string | null;
  maximum_party_size: string | null;
  directions: string | null;
  recommended_maps: string[];
  related_routes: string[];
}

export interface CourseDetail {
  title: string;
  url: string;
  category: string | null;
  description: string | null;
  dates: string | null;
  start_date: string | null;
  end_date: string | null;
  committee: string | null;
  committee_url: string | null;
  member_price: string | null;
  guest_price: string | null;
  availability: string | null;
  capacity: string | null;
  leaders: { name: string; role: string | null }[];
  badges_earned: string[];
}

export interface RouteSummary {
  title: string;
  url: string;
  type: string | null;
  description: string | null;
}

export interface ListResult<T> {
  total_count: number;
  items: T[];
  limit: number;
}

export interface SearchResult<T> {
  total_count: number;
  items: T[];
  page: number;
  has_more: boolean;
}
