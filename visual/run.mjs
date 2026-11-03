/**
 * The visual loop: serves Thaali against the fixture transport, captures every page in every
 * scenario and width in a WKWebView (the engine Tauri uses on macOS), runs the DOM checks on
 * each capture, and writes screenshots, results.json and report.md under `--out`.
 *
 * Usage: node visual/run.mjs --out <dir> [--pages hath,system] [--scenarios normal,asking]
 *        [--widths 1440,900x700,1080x1920] [--interact] [--flows]
 *
 * `--flows` adds the scripted flows (agent sheet and takeover modal, toasts, System task rows and logs, chat thread) at
 * 1440 wide in the `normal`, `asking` and `long` scenarios; `--flows-only` runs just those, and `--flow <name>` just the flows
 * whose name starts with it (`--flow chaavi`).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureServer, ensureTool, ORIGIN } from "./harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const PAGES = { home: "/", hath: "/hath", yaad: "/yaad", timeline: "/timeline", system: "/system", chaavi: "/chaavi", ghar: "/ghar" };
const SCENARIOS = ["normal", "loading", "offline", "blip", "module-offline", "errors", "empty", "long", "many", "asking"];
/** Width by height; the portrait monitor is 1080x1920. */
const SIZES = { "1440": [1440, 900], "900": [900, 700], "1920": [1920, 1080], "1080x1920": [1080, 1920] };
/** How long each scenario waits before its first capture. */
const SETTLE_MS = { loading: 900, blip: 6500, many: 4500 };

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error(`unexpected argument ${argv[i]}`);
    const key = argv[i].slice(2);
    out[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  if (typeof out.out !== "string") throw new Error("--out <dir> is required");
  return out;
}

function list(value, all) {
  return typeof value === "string" ? value.split(",") : all;
}

/** Steps after the first settled capture: expand something, watch the transition, hover. */
function interactionSteps(tag) {
  return [
    { eval: "window.__mountSince = performance.now(); 0" },
    { click: '[aria-expanded="false"]' },
    { wait: 120 },
    { shot: `${tag}~expand-120ms.png` },
    { wait: 520 },
    { shot: `${tag}~expand-640ms.png` },
    { checks: "after-expand" },
    { hover: "button, a[href]" },
    { wait: 200 },
    { shot: `${tag}~hover.png` },
  ];
}

const sidebarRow = (agent) => `[...document.querySelectorAll("button")].find((b) => b.textContent.includes("${agent}"))?.click()`;
/** Clicks the first element matching `selector` whose text holds `text`. */
const clickText = (selector, text) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((b) => b.textContent.includes(${JSON.stringify(text)}))?.click(); 0`;
/** Types `value` into the first input matching `selector` the way a person does, so React sees it. */
const typeInto = (selector, value) =>
  `(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("input", { bubbles: true })); })(); 0`;
/** Logs a console error naming `text` when the page does not show it (ignoring case, as caps labels read) (or, with `gone`, still shows it), so the report lists a flow whose action did nothing. */
const expectText = (text, gone = false) => `(() => { if (document.body.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) === ${gone}) console.error(${JSON.stringify(`flow expected ${gone ? "no " : ""}${text}`)}); })(); 0`;
/** Presses `key` in the first element matching `selector`. */
const pressKey = (selector, key) => `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, bubbles: true })); 0`;
const emit = (event) => `window.__fixtures.emit("hath", "/events", ${JSON.stringify({ ...event, at: "NOW" }).replace('"NOW"', "new Date().toISOString()")}); 0`;
const message = (seq, content) => ({ type: "message", agent_id: "finance-specialist", from_agent_id: "finance-specialist", to_agent_id: null, content, attachments: [], seq });

/** Scripted flows: each opens something, then captures its frames and runs the checks. */
function flowJobs(scenario) {
  const job = (name, route, steps, settleMs = 2500) => ({ name: `flow-${name}~${scenario}`, url: `${ORIGIN}${route}${route.includes("?") ? "&" : "?"}fixtures=${scenario}`, width: 1440, height: 900, settleMs, steps });
  const frames = (tag, times) => times.flatMap((t, i) => [{ wait: i === 0 ? t : t - times[i - 1] }, { shot: `flow-${tag}~${scenario}~${t}ms.png` }]);
  return [
    job("agent-sheet", "/hath", [
      { eval: sidebarRow("finance-specialist") },
      { wait: 900 },
      { shot: `flow-agent-thread~${scenario}.png` },
      { eval: "window.__mountSince = performance.now(); 0" },
      { click: '[aria-label$=" details"]' },
      ...frames("agent-sheet-open", [80, 300, 900]),
      { checks: "sheet-open" },
      { eval: '[...document.querySelectorAll("[aria-expanded=\'false\']")].slice(0, 2).forEach((b) => b.click()); 0' },
      ...frames("agent-sheet-expand", [100, 400, 1000]),
      { checks: "sheet-expanded" },
      { eval: "window.__mountSince = performance.now(); 0" },
      { click: '[aria-label^="Open browser task"]' },
      ...frames("takeover-open", [80, 300, 900]),
      { checks: "takeover-open" },
    ]),
    job("toasts", "/system", [
      { eval: "window.__mountSince = performance.now(); 0" },
      { eval: emit(message(3001, "Both pending charges are expected: Spotify and the gym, nothing else due before Friday.")) },
      ...frames("toast-info", [80, 320, 900]),
      { eval: emit({ type: "lane_failed", agent_id: "finance-specialist", lane: "work", message: "dwar returned 529 overloaded while reading the October statement" }) },
      { eval: emit({ type: "lane_failed", agent_id: "finance-specialist", lane: "work", message: "dwar returned 529 overloaded while reading the October statement" }) },
      ...frames("toast-error-folded", [1300]),
      { checks: "toasts" },
    ]),
    job("system-tasks", "/system", [
      { eval: 'document.querySelector(".trow")?.scrollIntoView({ block: "center" }); 0' },
      { wait: 200 },
      { eval: "window.__mountSince = performance.now(); 0" },
      { eval: 'document.querySelector(".trow > button")?.click(); 0' },
      ...frames("system-task-open", [100, 450, 1200]),
      { checks: "task-open" },
      { eval: '[...document.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent.startsWith("Working"))?.click(); 0' },
      ...frames("system-task-filtered", [300]),
    ]),
    job("system-logs", "/system", [
      { eval: "window.__mountSince = performance.now(); 0" },
      { eval: 'document.querySelector("[data-log-key] > button")?.click(); 0' },
      ...frames("system-log-pinned", [100, 450]),
      { checks: "log-pinned" },
      { eval: 'document.querySelector("[aria-haspopup=menu]")?.click(); 0' },
      ...frames("system-log-services", [200]),
      { eval: '[...document.querySelectorAll("[role=menuitem]")].find((b) => b.textContent.includes("hath"))?.click(); 0' },
      ...frames("system-log-service-chosen", [900]),
      { checks: "log-service" },
    ]),
    job("system-errors", "/system", [
      { eval: expectText("Open in logs") },
      { eval: expectText("request_id", true) },
      { eval: 'document.querySelector("button[title^=\'Show this line\']")?.click(); 0' },
      ...frames("system-error-opened", [200, 900]),
      { eval: expectText("request_id") },
      { eval: expectText("1 lines") },
    ]),
    job("chaavi-browse", "/chaavi", [
      { eval: clickText("button", "Checking account") },
      ...frames("chaavi-open-item", [120, 500]),
      { checks: "item-open" },
      { eval: '[...document.querySelectorAll("button[aria-label^=\'Reveal\']")][0]?.click(); 0' },
      ...frames("chaavi-reveal-refused", [400, 900]),
      { eval: clickText("button", "Favorites") },
      ...frames("chaavi-favorites", [300]),
      { eval: typeInto("input[aria-label='Search items']", "apple") },
      ...frames("chaavi-search", [300]),
      { eval: typeInto("input[aria-label='Search items']", "zzz") },
      ...frames("chaavi-search-none", [300]),
      { checks: "search-none" },
    ]),
    job("chaavi-sheet", "/chaavi", [
      { eval: "window.__mountSince = performance.now(); 0" },
      { eval: clickText("button", "New item") },
      ...frames("chaavi-sheet-open", [80, 320, 700]),
      { checks: "sheet-open" },
      { eval: clickText("button", "Create") },
      ...frames("chaavi-sheet-refused", [400]),
      { eval: clickText(".segmented button", "Bank account") },
      ...frames("chaavi-sheet-bank", [300]),
      { eval: typeInto("input[aria-label='Name']", "Savings") },
      { eval: clickText("button", "Create") },
      ...frames("chaavi-sheet-create-failed", [900]),
      { eval: '[...document.querySelectorAll("button[aria-label=Close]")][0]?.click(); 0' },
      ...frames("chaavi-sheet-close", [100, 250, 600]),
    ]),
    job("chaavi-delete", "/chaavi", [
      { eval: '[...document.querySelectorAll("button[aria-label=\'Delete item\']")][0]?.click(); 0' },
      ...frames("chaavi-delete-open", [80, 320]),
      { checks: "delete-open" },
      { eval: clickText("button", "Cancel") },
      ...frames("chaavi-delete-cancel", [100, 250, 600]),
    ]),
    job("hath-schedule", "/hath?agent=career-manager", [
      { eval: clickText("button", "Scheduled") },
      ...frames("hath-schedule-open", [400]),
      { eval: `document.querySelector("button[aria-label='Edit schedule 1']").click(); 0` },
      ...frames("hath-schedule-edit", [300]),
      { checks: "schedule-edit" },
      { eval: typeInto("textarea[aria-label=Message]", "Morning check, edited.") },
      { eval: clickText("button", "Save") },
      ...frames("hath-schedule-saved", [600]),
      { eval: expectText("Morning check, edited.") },
      { eval: `document.querySelector("button[aria-label='Edit schedule 2']").click(); 0` },
      { eval: clickText("button", "Cancel schedule") },
      ...frames("hath-schedule-confirm", [300]),
      { eval: expectText("This schedule will not run again.") },
      { eval: clickText("button", "Confirm cancel") },
      ...frames("hath-schedule-cancelled", [600]),
      { eval: expectText("Weekly spend summary for Ankur.", true) },
    ]),
    job("hath-activity", "/hath?agent=career-manager", [
      { eval: clickText("button", "Activity") },
      ...frames("hath-activity-open", [400]),
      { checks: "activity-open" },
      { eval: clickText("button", "earlier steps") },
      { eval: clickText("button[aria-expanded=false]", "search_files") },
      ...frames("hath-activity-unfolded", [400]),
      { eval: expectText("pattern") },
      { eval: clickText("button", "Show 3 older") },
      ...frames("hath-activity-older", [400]),
      { eval: expectText("The work lane stopped") },
      { eval: clickText(".segmented button", "Working") },
      ...frames("hath-activity-working", [400]),
    ]),
    job("hath-search", "/hath", [
      { eval: typeInto("[data-page=hath] input[aria-label='Search agents']", "finance") },
      ...frames("hath-search-typed", [400]),
      { eval: pressKey("[data-page=hath] input[aria-label='Search agents']", "Enter") },
      ...frames("hath-search-picked", [700]),
      { eval: expectText("Open thread") },
    ]),
    job("yaad-sheet", "/yaad?focus=y0000000-0000-4000-8000-000000000198", [
      ...frames("yaad-sheet-open", [900]),
      { checks: "yaad-sheet" },
      { eval: expectText("Coming up") },
      { eval: expectText("Remembered") },
      { eval: expectText("Connections") },
      { eval: expectText("from schedule-specialist") },
      { eval: 'document.querySelector("[data-page=yaad] button[aria-label=Close]").click(); 0' },
      ...frames("yaad-sheet-closed", [700]),
      { eval: expectText("Coming up", true) },
    ]),
    job("chat-thread", "/", [
      { eval: sidebarRow("finance-specialist") },
      ...frames("chat-open", [120, 600]),
      { checks: "thread" },
    ]),
  ];
}

function plan(opts, outDir) {
  const pages = opts["flows-only"] || typeof opts.flow === "string" ? [] : list(opts.pages, Object.keys(PAGES));
  const scenarios = list(opts.scenarios, SCENARIOS);
  const sizes = list(opts.widths, ["1440"]);
  const jobs = [];
  for (const page of pages) {
    for (const scenario of scenarios) {
      for (const size of sizes) {
        const [width, height] = SIZES[size] ?? size.split("x").map(Number);
        const tag = `${page}~${scenario}~${size}`;
        const steps = [{ shot: `${tag}.png` }, { checks: "settled" }];
        if (opts.interact) steps.push(...interactionSteps(tag));
        jobs.push({ name: tag, url: `${ORIGIN}${PAGES[page]}?fixtures=${scenario}`, width, height, settleMs: SETTLE_MS[scenario] ?? 2500, steps });
      }
    }
  }
  if (opts.flows || opts["flows-only"] || typeof opts.flow === "string") for (const scenario of ["normal", "asking", "long"]) jobs.push(...flowJobs(scenario));
  if (typeof opts.flow === "string") {
    return { outDir: join(outDir, "shots"), hookScript: join(here, "hook.js"), checksScript: join(here, "checks.js"), jobs: jobs.filter((job) => job.name.startsWith(`flow-${opts.flow}`)) };
  }
  return {
    outDir: join(outDir, "shots"),
    hookScript: join(here, "hook.js"),
    checksScript: join(here, "checks.js"),
    jobs,
  };
}

function report(results) {
  const lines = ["# Visual loop report", "", "| capture | errors | " + "findings |", "|---|---|---|"];
  const byType = new Map();
  for (const r of results) {
    const counts = {};
    for (const c of r.checks) for (const [k, v] of Object.entries(c.counts)) counts[k] = Math.max(counts[k] ?? 0, v);
    lines.push(`| ${r.name} | ${r.errors.length} | ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ") || "none"} |`);
    for (const c of r.checks) {
      for (const [type, items] of Object.entries(c.found)) {
        for (const item of items) {
          const key = `${type}|${item.el}|${item.text}`;
          const entry = byType.get(key) ?? { type, item, captures: new Set() };
          entry.captures.add(r.name);
          byType.set(key, entry);
        }
      }
    }
  }
  lines.push("", "## Findings by type", "");
  const grouped = new Map();
  for (const entry of byType.values()) grouped.set(entry.type, [...(grouped.get(entry.type) ?? []), entry]);
  for (const [type, entries] of [...grouped].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${type} (${entries.length})`, "");
    for (const e of entries.slice(0, 25)) lines.push(`- \`${e.item.el}\` "${e.item.text}" ${e.item.detail} — ${[...e.captures].slice(0, 3).join(", ")}${e.captures.size > 3 ? ` +${e.captures.size - 3}` : ""}`);
    lines.push("");
  }
  const errors = new Map();
  for (const r of results) for (const e of r.errors.filter((message) => !/vite/i.test(message))) errors.set(e, [...(errors.get(e) ?? []), r.name]);
  lines.push("## Console errors and warnings", "");
  for (const [message, captures] of errors) lines.push(`- ${message.slice(0, 220)} — ${captures.length} captures (${captures[0]})`);
  return lines.join("\n");
}

const opts = args();
const outDir = resolve(opts.out);
mkdirSync(outDir, { recursive: true });
const server = await ensureServer();
try {
  const bin = ensureTool("snap.swift", "snap");
  const planFile = join(outDir, "plan.json");
  const resultsFile = join(outDir, "results.json");
  writeFileSync(planFile, JSON.stringify(plan(opts, outDir), null, 1));
  const run = spawnSync(bin, [planFile, resultsFile], { stdio: "inherit" });
  if (run.status !== 0) throw new Error(`snapshot tool exited ${run.status}`);
  writeFileSync(join(outDir, "report.md"), report(JSON.parse(readFileSync(resultsFile, "utf8"))));
  console.log(`wrote ${join(outDir, "report.md")}`);
} finally {
  if (server) process.kill(-server.pid);
}
