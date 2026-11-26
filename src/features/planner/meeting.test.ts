import { describe, expect, it } from "vitest";
import type { Plan } from "../../types/planner";
import { meetingLink, placeIsOnlyLink } from "./meeting";

const base: Pick<Plan, "place" | "body" | "notes"> = { place: null, body: null, notes: [] };
const place = (title: string, address: string | null) => ({ id: "p", title, address, room: null });

describe("meetingLink", () => {
  it("names the service and host of a link in the place's address", () => {
    expect(meetingLink({ ...base, place: place("Standup", "https://meet.google.com/abc-defg-hij") })).toEqual({ url: "https://meet.google.com/abc-defg-hij", service: "Google Meet", host: "meet.google.com", source: "address" });
  });

  it("reads the place title, then the body, then the notes, in that order", () => {
    expect(meetingLink({ ...base, place: place("zoom.us/j/123456", null) })).toMatchObject({ service: "Zoom", url: "https://zoom.us/j/123456", source: "title" });
    expect(meetingLink({ ...base, body: "Join at https://us02web.zoom.us/j/99?pwd=x, bring notes." })).toMatchObject({ service: "Zoom", host: "us02web.zoom.us", url: "https://us02web.zoom.us/j/99?pwd=x", source: "body" });
    expect(meetingLink({ ...base, notes: [{ id: "n", title: "Call", body: "teams.microsoft.com/l/meetup-join/abc" }] })).toMatchObject({ service: "Microsoft Teams", source: "note" });
  });

  it("knows the other services, and calls a plain one a video call", () => {
    expect(meetingLink({ ...base, body: "https://teams.live.com/meet/1" })?.service).toBe("Microsoft Teams");
    expect(meetingLink({ ...base, body: "https://acme.webex.com/meet/jo" })?.service).toBe("Webex");
    expect(meetingLink({ ...base, body: "https://whereby.com/room" })?.service).toBe("Whereby");
    expect(meetingLink({ ...base, body: "https://meet.jit.si/room" })?.service).toBe("Video call");
  });

  it("is null for a plan with no call link, even one that mentions other links", () => {
    expect(meetingLink({ ...base, place: place("Wells Hall", "619 Red Cedar Rd"), body: "Notes at https://example.com/doc" })).toBeNull();
    expect(meetingLink(base)).toBeNull();
  });

  it("recognises a place that is nothing but the link, so no second row repeats it", () => {
    const link = meetingLink({ ...base, place: place("Zoom", "https://zoom.us/j/1") })!;
    expect(placeIsOnlyLink({ place: place("Zoom", "https://zoom.us/j/1") }, link)).toBe(true);
    expect(placeIsOnlyLink({ place: place("Wells Hall", "619 Red Cedar Rd") }, link)).toBe(false);
    expect(placeIsOnlyLink({ place: null }, link)).toBe(true);
  });
});
