import {
  demoMe,
  seedPosts,
  venues,
  type Profile,
  type Checkin,
  type Post,
  type Request,
} from "./data";
export type Demo = {
  profile: Profile;
  checkin: Checkin | null;
  posts: Post[];
  requests: Request[];
};
export const STORAGE_KEY = "herefolk-v1";
export function freshDemo(): Demo {
  return {
    profile: { ...demoMe },
    checkin: null,
    posts: seedPosts(),
    requests: [
      {
        id: "demo-invite",
        sender_id: "demo-c",
        receiver_id: demoMe.id,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ],
  };
}
const validProfile = (p: any): p is Profile =>
  p &&
  p.id === demoMe.id &&
  typeof p.display_name === "string" &&
  p.display_name.trim().length >= 2 &&
  p.display_name.length <= 40 &&
  typeof p.bio === "string" &&
  p.bio.length <= 180;
export function readDemo(storage: Pick<Storage, "getItem">): Demo {
  try {
    const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem("localloop-v1");
    if (!raw) return freshDemo();
    const d = JSON.parse(raw);
    if (
      !validProfile(d.profile) ||
      !Array.isArray(d.posts) ||
      !Array.isArray(d.requests)
    )
      return freshDemo();
    const posts = d.posts.filter(
      (p: any) =>
        p &&
        typeof p.id === "string" &&
        typeof p.user_id === "string" &&
        venues.some((v) => v.id === p.venue_id) &&
        typeof p.content === "string" &&
        p.content.trim().length > 0 &&
        p.content.length <= 500 &&
        Number.isFinite(Date.parse(p.created_at)) &&
        (!p.profiles ||
          (typeof p.profiles.id === "string" &&
            typeof p.profiles.display_name === "string" &&
            typeof p.profiles.bio === "string")),
    );
    const requests = d.requests.filter(
      (r: any) =>
        r &&
        typeof r.id === "string" &&
        typeof r.sender_id === "string" &&
        typeof r.receiver_id === "string" &&
        r.sender_id !== r.receiver_id &&
        ["pending", "accepted", "declined"].includes(r.status),
    );
    const c = d.checkin;
    const checkin =
      c &&
      c.user_id === d.profile.id &&
      venues.some((v) => v.id === c.venue_id) &&
      typeof c.id === "string" &&
      Number.isFinite(Date.parse(c.expires_at))
        ? c
        : null;
    return { profile: d.profile, checkin, posts, requests };
  } catch {
    return freshDemo();
  }
}
export function initialDemo() {
  try {
    return readDemo(localStorage);
  } catch {
    return freshDemo();
  }
}
export function isActive(checkin: Checkin | null, now = Date.now()) {
  return !!checkin && Date.parse(checkin.expires_at) > now;
}
export function timeAgo(date: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
export function friendlyError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  if (/failed to fetch|network|load failed/i.test(message))
    return "We could not connect. Check your internet connection and try again.";
  if (/row-level security|permission denied|jwt|expired session/i.test(message))
    return "Your session may have expired. Sign in again and retry.";
  return message;
}
