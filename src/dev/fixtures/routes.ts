import type { NasTask } from "../../shared/api/nas";
import type { GharCommand, GharDevice } from "../../types/ghar";
import type { PostMessageResponse, ThreadReadMark } from "../../types/hath";
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
    if (agent) {
      const [, id, sub] = agent;
      if (route.startsWith("GET") && sub === undefined) return hath.agentDetail(s, id!);
      if (route.startsWith("GET") && sub === "/messages") return { messages: hath.messages(s, id!) };
      if (route.startsWith("GET") && sub === "/logs") return { logs: hath.agentLogs(id!) };
      if (route.startsWith("GET") && sub === "/schedules") return { schedules: hath.schedules(id!) };
      if (route.startsWith("POST") && sub === "/read") {
        const mark: ThreadReadMark = { agent_id: id!, read_seq: (body as { seq: number }).seq, unread: 0 };
        return mark;
      }
    }
    throw new Error(`fixtures: no route for hath ${route}${url.search}`);
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
    if (route === "GET /devices") return { devices: this.devices };
    if (route === "GET /rooms") return { rooms: ghar.rooms(this.scenario) };
    if (route === "GET /events") return { events: [] };
    const command = /^POST \/devices\/([^/]+)\/command$/.exec(route);
    if (command) {
      this.applyCommand(command[1]!, body as GharCommand);
      return undefined;
    }
    throw new Error(`fixtures: no route for ghar ${route}`);
  }

  private applyCommand(id: string, command: GharCommand): void {
    const device = this.devices.find((d) => d.id === id);
    if (!device) {
      throw new Error(`fixtures: no ghar device ${id}`);
    }
    const now = ago(0);
    if (command.capability === "on_off" && command.command !== "toggle") {
      device.state.on = { value: command.command === "on", changed_at: now };
    }
    if (command.capability === "on_off" && command.command === "toggle") {
      device.state.on = { value: device.state.on?.value !== true, changed_at: now };
    }
    if (command.capability === "level" && typeof command.params?.level === "number") {
      device.state.brightness = { value: command.params.level, changed_at: now };
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
