import type { NasTask } from "../../shared/api/nas";
import { applyCommand } from "../../features/ghar/model";
import type { GharCommand, GharCommissionJob, GharDevice, GharTag } from "../../types/ghar";
import type { PatchScheduleRequest, PostMessageResponse, ScheduledMessage, ThreadReadMark } from "../../types/hath";
import type { QueryRequest } from "../../types/yaad";
import type { TimelineRequest } from "../../types/timeline";
import type { Scenario } from "../scenario";
import * as chaavi from "./chaavi";
import * as ghar from "./ghar";
import * as hath from "./hath";
import * as nas from "./nas";
import { nasTasks } from "./tasks";
import { timeline } from "./timeline";
import * as yaad from "./yaad";
import { ago } from "./time";

/** Entries Nas returns from `GET /logs` when the request names no limit. */
const DEFAULT_LOG_LIMIT = 200;

/** A service host in the mesh, as the fixture routes name it. */
export type Host = "hath" | "nas" | "yaad" | "ghar" | "chaavi";

/** What a route needs of a request. */
export type FixtureRequest = {
  host: Host;
  method: string;
  /** Path and query, as the client sent them. */
  path: string;
  body: unknown;
};

/**
 * The answers every dadi service gives in fixture mode: typed data from the fixtures
 * modules, with the few writes a page makes applied to a copy so a toggle sticks until
 * the page is reloaded. A request no route knows throws, so a missing fixture is loud.
 */
export class Fixtures {
  private readonly devices: GharDevice[];
  private readonly tasks: NasTask[];
  private readonly schedules = new Map<string, ScheduledMessage[]>();

  constructor(private readonly scenario: Scenario) {
    this.devices = ghar.devices(scenario);
    this.tasks = nasTasks(scenario);
  }

  /** The body of the response to `request`. */
  respond({ host, method, path, body }: FixtureRequest): unknown {
    const url = new URL(path, "http://fixtures.invalid");
    const route = `${method} ${url.pathname}`;
    switch (host) {
      case "hath":
        return this.hath(route, url, body);
      case "nas":
        return this.nas(route, url);
      case "yaad":
        return this.yaad(route, body);
      case "ghar":
        return this.ghar(route, body);
      case "chaavi":
        return this.chaavi(route);
    }
  }

  private hath(route: string, url: URL, body: unknown): unknown {
    const s = this.scenario;
    const agent = /^\w+ \/agents\/([^/]+)(\/\w+)?$/.exec(route);
    if (route === "GET /health") return hath.health();
    if (route === "GET /agents") return { agents: hath.agents(s) };
    if (route === "GET /threads") return { threads: hath.threads(s) };
    if (route === "GET /logs") return { logs: hath.agentLogs("finance-specialist") };
    if (route === "POST /devices/presence") {
      return { ...(body as { node_name: string; platform: string; app_version: string }), at: ago(0) };
    }
    if (route === "GET /router") return { running: [] };
    if (route === "POST /router") return { messages: [] };
    if (route === "POST /messages") {
      const sent = body as { to_agent_id: string; content: string };
      const response: PostMessageResponse = { to_agent_id: sent.to_agent_id, content: sent.content, attachments: [], seq: 2000, created_at: ago(0) };
      return response;
    }
    const schedule = /^(PATCH|DELETE) \/schedules\/([^/]+)$/.exec(route);
    if (schedule) {
      return schedule[1] === "PATCH" ? this.patchSchedule(schedule[2]!, body as PatchScheduleRequest) : this.cancelSchedule(schedule[2]!);
    }
    if (agent) {
      const [, id, sub] = agent;
      if (route.startsWith("GET") && sub === undefined) return hath.agentDetail(s, id!);
      if (route.startsWith("GET") && sub === "/messages") return { messages: hath.messages(s, id!) };
      if (route.startsWith("GET") && sub === "/logs") return { logs: hath.agentLogs(id!) };
      if (route.startsWith("GET") && sub === "/schedules") return { schedules: structuredClone(this.schedulesOf(id!)) };
      if (route.startsWith("POST") && sub === "/read") {
        const mark: ThreadReadMark = { agent_id: id!, read_seq: (body as { seq: number }).seq, unread: 0 };
        return mark;
      }
    }
    throw new Error(`fixtures: no route for hath ${route}${url.search}`);
  }

  /** The schedules of `agentId` a page may have edited or cancelled since it loaded. */
  private schedulesOf(agentId: string): ScheduledMessage[] {
    const held = this.schedules.get(agentId) ?? hath.schedules(agentId);
    this.schedules.set(agentId, held);
    return held;
  }

  private patchSchedule(id: string, body: PatchScheduleRequest): ScheduledMessage {
    for (const held of this.schedules.values()) {
      const found = held.find((schedule) => schedule.id === id);
      if (found !== undefined) {
        return Object.assign(found, body);
      }
    }
    throw new Error(`fixtures: no schedule ${id}`);
  }

  private cancelSchedule(id: string): { cancelled: true; schedule_id: string } {
    for (const held of this.schedules.values()) {
      const index = held.findIndex((schedule) => schedule.id === id);
      if (index >= 0) {
        held.splice(index, 1);
        return { cancelled: true, schedule_id: id };
      }
    }
    throw new Error(`fixtures: no schedule ${id}`);
  }

  private nas(route: string, url: URL): unknown {
    const s = this.scenario;
    if (route === "GET /health") return { status: "ok" };
    if (route === "GET /status") return nas.status(s);
    if (route === "GET /tasks") return this.tasks.map((task) => ({ ...task }));
    const driven = /^POST \/(browsers|terminals)\/([^/]+)\/(input|keys)$/.exec(route);
    if (driven) {
      this.settleTask((task) => task.resource === driven[2] && task.kind === (driven[1] === "browsers" ? "browser" : "terminal"), "paused");
      return driven[1] === "terminals" ? { sent: true } : undefined;
    }
    const handBack = /^POST \/tasks\/(browser|terminal)\/([^/]+)\/(resume|stop)$/.exec(route);
    if (handBack) {
      return this.settleTask((task) => task.kind === handBack[1] && task.id === handBack[2], handBack[3] === "stop" ? "asleep" : "working");
    }
    if (route === "GET /logs/services") return { services: nas.logServices() };
    if (route === "GET /logs") return { entries: this.filterLogs(url) };
    if (route === "GET /clients") return nas.clients();
    if (route === "GET /headscale/publish") return nas.headscalePublish();
    if (/^GET \/terminals\/[^/]+\/capture$/.test(route)) return nas.terminalCapture();
    throw new Error(`fixtures: no route for nas ${route}${url.search}`);
  }

  /** Puts the task `match` finds in `status`, as Nas does when Ankur drives, hands back or stops it, and answers with it. */
  private settleTask(match: (task: NasTask) => boolean, status: NasTask["status"]): NasTask {
    const task = this.tasks.find(match);
    if (task === undefined) {
      throw new Error("fixtures: no task to settle");
    }
    task.status = status;
    return { ...task };
  }

  private filterLogs(url: URL) {
    const services = url.searchParams.get("services");
    const level = url.searchParams.get("level");
    const q = url.searchParams.get("q");
    const limit = Number(url.searchParams.get("limit") ?? DEFAULT_LOG_LIMIT);
    return nas
      .logEntries(this.scenario)
      .filter((e) => (services === null || services.split(",").includes(e.service)) && (level === null || e.level === level) && (q === null || e.raw?.includes(q)))
      .slice(0, limit);
  }

  private yaad(route: string, body: unknown): unknown {
    const s = this.scenario;
    if (route === "POST /graph") return yaad.graph(s);
    if (route === "POST /query") return yaad.query(s, body as QueryRequest);
    if (route === "POST /timeline") return timeline(s, body as TimelineRequest);
    if (route === "PUT /timeline/outcome") {
      const outcome = body as { plan_id: string; occurrence_date: string; outcome: "done" | null };
      return { ...outcome, outcome_at: outcome.outcome === null ? null : ago(0) };
    }
    const node = /^GET \/nodes\/([^/]+)$/.exec(route);
    if (node) return yaad.node(s, node[1]!);
    throw new Error(`fixtures: no route for yaad ${route}`);
  }

  private ghar(route: string, body: unknown): unknown {
    if (route === "GET /health") return { status: "ok" };
    if (route === "GET /devices") return { devices: structuredClone(this.devices) };
    if (route === "GET /events") return { events: [] };
    const tag = /^(PATCH|DELETE) \/tags\/([^/]+)$/.exec(route);
    if (tag) {
      for (const device of this.devices) {
        device.tags = tag[1] === "DELETE" ? device.tags.filter((t) => t.id !== tag[2]) : device.tags.map((t) => (t.id === tag[2] ? { ...t, name: (body as { name: string }).name } : t));
      }
      return tag[1] === "DELETE" ? undefined : this.tagNamed((body as { name: string }).name);
    }
    const members = /^POST \/tags\/([^/]+)\/devices$/.exec(route);
    if (members) {
      const named = this.tagById(members[1]!);
      for (const device of this.devices.filter((d) => (body as { device_ids: string[] }).device_ids.includes(d.id))) {
        if (!device.tags.some((t) => t.id === named.id)) device.tags.push(named);
      }
      return undefined;
    }
    const member = /^DELETE \/tags\/([^/]+)\/devices\/([^/]+)$/.exec(route);
    if (member) {
      const device = this.devices.find((d) => d.id === member[2]);
      if (!device) throw new Error(`fixtures: no ghar device ${member[2]}`);
      device.tags = device.tags.filter((t) => t.id !== member[1]);
      return undefined;
    }
    const patch = /^PATCH \/devices\/([^/]+)$/.exec(route);
    if (patch) return this.patchDevice(patch[1]!, body as { name?: string; tags?: string[] });
    const command = /^POST \/devices\/([^/]+)\/command$/.exec(route);
    if (command) {
      const index = this.devices.findIndex((d) => d.id === command[1]);
      if (index < 0) throw new Error(`fixtures: no ghar device ${command[1]}`);
      this.devices[index] = applyCommand(this.devices[index]!, body as GharCommand);
      return undefined;
    }
    if (/^POST \/devices\/[^/]+\/identify$/.test(route)) return undefined;
    if (route === "POST /commission") return { job_id: this.commissionJob((body as { code: string }).code) };
    const job = /^GET \/commission\/([^/]+)$/.exec(route);
    if (job) return this.commission(job[1]!);
    throw new Error(`fixtures: no route for ghar ${route}`);
  }

  private patchDevice(id: string, body: { name?: string; tags?: string[] }): GharDevice {
    const device = this.devices.find((d) => d.id === id);
    if (!device) {
      throw new Error(`fixtures: no ghar device ${id}`);
    }
    if (body.name !== undefined) device.name = body.name;
    if (body.tags !== undefined) device.tags = body.tags.map((name) => this.tagNamed(name));
    return device;
  }

  /** The tag a name stands for: the one a device already carries, or a new one. */
  private tagNamed(name: string): GharTag {
    const known = this.devices.flatMap((d) => d.tags).find((t) => t.name === name);
    return known ?? { id: `t-${name}`, name };
  }

  private tagById(id: string): GharTag {
    const known = this.devices.flatMap((d) => d.tags).find((t) => t.id === id);
    if (!known) throw new Error(`fixtures: no ghar tag ${id}`);
    return known;
  }

  /** The commission job a setup code starts: its first four digits choose how far it gets (0000 listening, 1111 pairing, 2222 paired, else failed). */
  private commissionJob(code: string): string {
    const stage = { "0000": "discovering", "1111": "commissioning", "2222": "succeeded" }[code.slice(0, 4)] ?? "failed";
    return `job-${stage}`;
  }

  private commission(jobId: string): GharCommissionJob {
    const base = { id: jobId, node_id: null, started_at: ago(0), finished_at: null };
    switch (jobId) {
      case "job-discovering":
        return { ...base, device_ids: null, status: "discovering", error: null };
      case "job-commissioning":
        return { ...base, device_ids: null, status: "commissioning", error: null };
      case "job-succeeded":
        return { ...base, device_ids: [this.devices[2]!.id], status: "succeeded", error: null, finished_at: ago(0) };
      default:
        return { ...base, device_ids: null, status: "failed", error: "Ghar found no device with that code.", finished_at: ago(0) };
    }
  }

  private chaavi(route: string): unknown {
    const s = this.scenario;
    if (route === "GET /health") return chaavi.health();
    if (route === "GET /v1/items") return { items: chaavi.items(s) };
    if (route === "GET /v1/folders") return { folders: chaavi.folders(s) };
    if (/^POST \/v1\/items\/[^/]+\/totp$/.test(route)) return chaavi.totp();
    throw new Error(`fixtures: no route for chaavi ${route}`);
  }
}
