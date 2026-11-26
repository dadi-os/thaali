import type { Plan } from "../../types/planner";

/** The video call a plan points at: where to join it, which service it is, and where in the plan the link was found. */
export type MeetingLink = {
  /** The full address to open, always with a scheme. */
  url: string;
  /** The service by name ("Google Meet", "Zoom", "Microsoft Teams"), or "Video call" for one without a friendlier name. */
  service: string;
  /** The link's host, "meet.google.com". */
  host: string;
  /** Where the link was found: the place's address or title, the plan's body, or one of its notes. */
  source: "address" | "title" | "body" | "note";
};

/** Hosts of video-call services, matched as the host itself or any subdomain of it. */
const SERVICES: ReadonlyArray<readonly [host: string, service: string]> = [
  ["meet.google.com", "Google Meet"],
  ["zoom.us", "Zoom"],
  ["zoom.com", "Zoom"],
  ["teams.microsoft.com", "Microsoft Teams"],
  ["teams.live.com", "Microsoft Teams"],
  ["webex.com", "Webex"],
  ["whereby.com", "Whereby"],
  ["facetime.apple.com", "FaceTime"],
  ["around.co", "Around"],
  ["meet.jit.si", "Video call"],
  ["bluejeans.com", "Video call"],
  ["gotomeet.me", "Video call"],
  ["gotomeeting.com", "Video call"],
  ["join.skype.com", "Video call"],
];

/** A web address in free text: with a scheme, or a bare service host and path. */
const URL_PATTERN = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"')\]]*)?/gi;

function serviceOf(host: string): string | null {
  const bare = host.toLowerCase();
  for (const [name, service] of SERVICES) {
    if (bare === name || bare.endsWith(`.${name}`)) return service;
  }
  return null;
}

/** The video-call link in `text`, when it holds one of a known service. */
function linkIn(text: string | null | undefined, source: MeetingLink["source"]): MeetingLink | null {
  if (text === null || text === undefined) return null;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(/[.,;:!?]+$/, "");
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    const service = serviceOf(host);
    if (service !== null) return { url, service, host, source };
  }
  return null;
}

/**
 * The video call a plan is held on, found on the client: the first link of a known service in the place's address, the
 * place's title, the plan's body, then its notes. Null for a plan that is not virtual. (A first-class link in Yaad would
 * make this reading unnecessary.)
 */
export function meetingLink(plan: Pick<Plan, "place" | "body" | "notes">): MeetingLink | null {
  return (
    linkIn(plan.place?.address, "address") ??
    linkIn(plan.place?.title, "title") ??
    linkIn(plan.body, "body") ??
    plan.notes.map((note) => linkIn(note.title, "note") ?? linkIn(note.body, "note")).find((found) => found !== null) ??
    null
  );
}

/**
 * Whether the plan's place is only its video link, so there is no place to show beside the Join row: its address is the link or
 * empty and its title is the link, the service's name, or nothing more.
 */
export function placeIsOnlyLink(plan: Pick<Plan, "place">, link: MeetingLink): boolean {
  const place = plan.place;
  if (place === null) return true;
  const plain = (text: string | null) => (text ?? "").trim().toLowerCase();
  const isLink = (text: string | null) => text === null || text.trim() === "" || linkIn(text, "title")?.host === link.host;
  const named = plain(place.title) === plain(link.service) || plain(place.title) === "zoom" || plain(place.title) === "online" || plain(place.title) === "virtual";
  return isLink(place.address) && (isLink(place.title) || named);
}
