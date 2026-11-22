/**
 * The visual loop: serves Thaali against the fixture transport, captures every page in every
 * scenario and width in a WKWebView (the engine Tauri uses on macOS), runs the DOM checks on
 * each capture, and writes screenshots, results.json and report.md under `--out`.
 *
 * Usage: node visual/run.mjs --out <dir> [--pages hath,system] [--scenarios normal,asking]
 *        [--widths 1440,900x700,1080x1920] [--interact] [--flows]
 *
 * `--polish` runs only the refinement captures (thread pill, thread scroll edges (blur does not render in WKWebView), System tile, Home timeline tile, Hath hover, Day view and its rail
 * at three sizes, session popovers with long content at the window's edges, Month, Segmented states); set `SNAP_DARK=1` for the dark scheme.
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

const PAGES = { home: "/", hath: "/hath", yaad: "/yaad", planner: "/planner", "planner-week": "/planner?view=week", "planner-month": "/planner?view=month", "planner-someday": "/planner?someday=1", "home@11": "/?clock=11:00", "home@1320": "/?clock=13:20", "home@1500": "/?clock=15:00", "home@2230": "/?clock=22:30", "week@11": "/planner?view=week&clock=11:00", "week-past": "/planner?view=week&clock=11:00&date=2026-11-11", "week-future": "/planner?view=week&clock=11:00&date=2026-11-30", "week@8": "/planner?view=week&clock=08:00", "week-mid": "/planner?view=week&clock=14:20&clockdays=-3", "planner@11": "/planner?clock=11:00", "planner@1320": "/planner?clock=13:20", "week@1320": "/planner?view=week&clock=13:20", system: "/system", chaavi: "/chaavi", ghar: "/ghar" };
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
  const job = (name, route, steps, settleMs = 2500, height = 900, width = 1440) => ({ name: `flow-${name}~${scenario}`, url: `${ORIGIN}${route}${route.includes("fixtures=") ? "" : `${route.includes("?") ? "&" : "?"}fixtures=${scenario}`}`, width, height, settleMs, steps });
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
    job("takeover", "/system", [
      { eval: '[...document.querySelectorAll("button")].find((b) => b.textContent.includes("3f2a91"))?.scrollIntoView({ block: "center" }); 0' },
      { wait: 300 },
      { eval: clickText("button", "3f2a91") },
      ...frames("takeover-browser-watching", [1200]),
      { eval: expectText("Takeover") },
      { eval: clickText("button", "Takeover") },
      ...frames("takeover-browser-in-control", [900]),
      { eval: expectText("Return") },
      { eval: clickText("button", "Return") },
      ...frames("takeover-browser-returned", [900]),
      { eval: expectText("Takeover") },
      { eval: `(() => { const note = window.__fixtures.resumeNotes().at(-1)?.note ?? ""; if (!note.startsWith("Ankur took over this browser")) console.error("flow expected a browser summary note, got " + note); })(); 0` },
      { eval: '[...document.querySelectorAll("button[aria-label=Close]")][0]?.click(); 0' },
      { wait: 700 },
      { eval: '[...document.querySelectorAll("button")].find((b) => b.textContent.includes("b7710c"))?.scrollIntoView({ block: "center" }); 0' },
      { wait: 300 },
      { eval: clickText("button", "b7710c") },
      ...frames("takeover-terminal-watching", [1200]),
      { eval: clickText("button", "Takeover") },
      { wait: 700 },
      { eval: `(() => { const pane = document.querySelector("pre[tabindex='0']"); for (const key of ["l", "s", " ", "-", "l", "a"]) pane.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); })(); 0` },
      ...frames("takeover-terminal-typing", [900]),
      { eval: expectText("$ ls -la") },
      { eval: `document.querySelector("pre[tabindex='0']").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); 0` },
      { wait: 500 },
      { eval: clickText("button", "Return") },
      { wait: 700 },
      { eval: `(() => { const note = window.__fixtures.resumeNotes().at(-1)?.note ?? ""; if (!note.includes("ran: " + String.fromCharCode(96) + "ls -la")) console.error("flow expected a terminal summary note, got " + note); })(); 0` },
    ]),
    job("toasts", "/system", [
      { eval: "window.__mountSince = performance.now(); 0" },
      { eval: emit(message(3001, "Both pending charges are expected: Spotify and the gym, nothing else due before Friday.")) },
      ...frames("toast-info", [80, 320, 900]),
      { eval: emit({ type: "wake_ended", agent_id: "finance-specialist", wake_id: "00000000-0000-4000-9000-000000000008", outcome: "failed" }) },
      { eval: emit({ type: "wake_ended", agent_id: "finance-specialist", wake_id: "00000000-0000-4000-9000-000000000008", outcome: "failed" }) },
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
    job("hath-routines", "/hath?agent=career-manager", [
      ...frames("hath-routines-open", [500]),
      { eval: expectText("Application sweep") },
      { eval: expectText("Weekdays at 9:00 AM") },
      { eval: `document.querySelector("button[aria-label='Cancel Application sweep']").click(); 0` },
      ...frames("hath-routines-confirm", [400]),
      { eval: expectText("It will not run again.") },
      { eval: clickText("button", "Cancel routine") },
      ...frames("hath-routines-cancelled", [700]),
      { eval: expectText("Application sweep", true) },
    ]),
    job("hath-activity", "/hath?agent=finance-specialist", [
      ...frames("hath-activity-open", [600]),
      { checks: "activity-open" },
      { eval: expectText("Current call") },
      { eval: clickText("button", "earlier steps") },
      { wait: 700 },
      { eval: clickText("button[aria-expanded=false]", "search_files") },
      ...frames("hath-activity-unfolded", [700]),
      { eval: expectText("pattern") },
      { eval: clickText("button", "Load earlier") },
      ...frames("hath-activity-older", [700]),
    ]),
    ...["health-specialist", "cse-300-specialist", "efficiency-specialist", "coding-manager", "networking-specialist"].map((agent) => job(`hath-state-${agent}`, `/hath?agent=${agent}`, [{ wait: 700 }, { shot: `flow-hath-state-${agent}~${scenario}.png` }])),
    job("hath-popover-open", "/hath", [
      { eval: `document.querySelector('circle[aria-label="Open finance-specialist"]').dispatchEvent(new MouseEvent("click", { bubbles: true })); 0` },
      ...frames("hath-popover-open", [50, 160, 320, 520, 800, 1400]),
    ]),
    job("hath-about", "/hath?agent=career-manager", [
      { eval: `document.querySelector("[role=dialog] .scroll").scrollTop = 99999; 0` },
      ...frames("hath-about-shut", [700]),
      { eval: clickText("[role=dialog] button", "Charter") },
      { eval: `document.querySelector("[role=dialog] .scroll").scrollTop = 99999; 0` },
      ...frames("hath-about-open", [900]),
    ]),
    job("hath-long", "/hath?agent=application-wells-fargo-technology-summer-internship-software-engineering&fixtures=long", [{ wait: 800 }, { shot: "flow-hath-long~long.png" }]),
    job("hath-narrow", "/hath?agent=finance-specialist", [{ wait: 800 }, { shot: `flow-hath-narrow~${scenario}.png` }], 2500, 640, 760),
    job("hath-wake-open", "/hath?agent=finance-specialist", [
      { eval: `document.querySelector("[role=dialog] .scroll").scrollTop = 99999; 0` },
      { wait: 500 },
      { eval: clickText("[role=dialog] [class*='cursor-pointer']", "Opened by") },
      ...frames("hath-wake-open", [200, 800]),
    ]),
    job("hath-popover-list", "/hath?view=list", [
      { eval: `[...document.querySelectorAll(".agent-row")].find((b) => b.textContent.includes("finance-specialist")).click(); 0` },
      ...frames("hath-popover-list", [50, 160, 320, 520, 800, 1400]),
    ]),
    job("hath-stop", "/hath?agent=finance-specialist", [
      { eval: `document.querySelector("button[aria-label='Stop finance-specialist']").click(); 0` },
      ...frames("hath-stop-confirm", [400]),
      { eval: expectText("Ends the run and its helper tasks.") },
      { eval: clickText("button", "Stop") },
      ...frames("hath-stop-stopped", [1000]),
      { eval: expectText("Stopped by you") },
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
    job("planner-tick", `/planner?view=day&clock=11:00&fixtures=${scenario}`, [
      { eval: "window.__mountSince = performance.now(); 0" },
      { eval: 'document.querySelector("[role=checkbox][aria-label$=\\"Reply to the Northwind recruiter\\"]").click(); 0' },
      ...frames("planner-tick", [120, 400, 1100]),
      { eval: expectText("Checked off") },
      { eval: clickText("button", "Undo") },
      ...frames("planner-tick-undone", [600]),
    ]),
    job("planner-someday", `/planner?view=day&clock=11:00&someday=1&fixtures=${scenario}`, [
      ...frames("planner-someday-open", [900]),
      { eval: expectText("Gym training split") },
      { eval: clickText("button[aria-expanded=false]", "Gym training split") },
      ...frames("planner-someday-group", [400]),
    ], 2500, 640),
    job("planner-plan", `/planner?view=day&clock=11:00&fixtures=${scenario}`, [
      { eval: clickText("button[aria-haspopup=dialog]", "Study block") },
      ...frames("planner-plan-card", [700]),
      { eval: expectText("Date") },
    ]),
    job("planner-task", `/planner?view=day&clock=11:00&fixtures=${scenario}`, [
      { eval: 'document.querySelector("section[aria-label=\'Past due\'] button[aria-haspopup=dialog]").click(); 0' },
      ...frames("planner-task-card", [700]),
      { eval: expectText("Past due by") },
      { eval: expectText("Last confirmed") },
    ]),
    job("planner-where", `/planner?view=day&clock=11:00&fixtures=${scenario}`, [
      { eval: clickText("button[aria-haspopup=dialog]", "Coffee with Maya") },
      { wait: 500 },
      { eval: 'document.querySelector("button[aria-label=\\"Copy address\\"]").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); 0' },
      ...frames("planner-where-hover", [400]),
      { eval: 'document.querySelector("button[aria-label=\\"Copy address\\"]").click(); 0' },
      ...frames("planner-where-copied", [300]),
    ]),
    job("planner-widget-menu", `/?clock=11:00&fixtures=${scenario}`, [
      { eval: 'const row = document.querySelector("[data-plan]"); const box = row.getBoundingClientRect(); row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: box.left + 80, clientY: box.top + 20 })); 0' },
      ...frames("planner-widget-menu", [500]),
      { eval: expectText("Show in Yaad") },
    ]),
    job("planner-day-more", `/planner?view=month&fixtures=${scenario}`, [
      { eval: clickText("button", "more") },
      ...frames("planner-day-card", [700]),
      { eval: expectText("Open day") },
    ]),
    job("chat-thread", "/", [
      { eval: sidebarRow("finance-specialist") },
      ...frames("chat-open", [120, 600]),
      { checks: "thread" },
    ]),
  ];
}

/** A click at a viewport point on the first button whose text holds `text`, as a pointer press does, so a popover opens beside that point. */
const clickAt = (text, x, y) =>
  `(() => { const b = [...document.querySelectorAll("button")].find((el) => el.textContent.includes(${JSON.stringify(text)})); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: ${x}, clientY: ${y}, detail: 1 })); })(); 0`;
const escape = `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); 0`;

/** The refinement captures: one job each, at the sizes the checks call for. */
function polishJobs() {
  const job = (name, route, steps, width = 1440, height = 900, settleMs = 3000) => ({ name: `polish-${name}`, url: `${ORIGIN}${route}${route.includes("?") ? "&" : "?"}fixtures=${route.includes("fixtures=") ? "" : "normal"}`.replace(/fixtures=$/, ""), width, height, settleMs, steps });
  const edges = (tag, width, height) =>
    Object.entries({ tl: [10, 10], tr: [width - 10, 10], bl: [10, height - 10], br: [width - 10, height - 10], l: [10, height / 2], r: [width - 10, height / 2], c: [width / 2, height / 2] }).flatMap(([edge, [x, y]]) => [
      { eval: clickAt("Study block", Math.round(x), Math.round(y)) },
      { wait: 700 },
      { shot: `polish-popover-${tag}-${edge}.png` },
      { eval: `(() => { const d = document.querySelector("[role=dialog]"); if (!d) return console.error("no popover at ${edge}"); const r = d.getBoundingClientRect(); const body = d.querySelector("[data-selectable]"); if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight || d.scrollWidth > d.clientWidth + 1) console.error("popover ${tag} ${edge} out of window: " + [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight].map(Math.round).join(",")); })(); 0` },
      { eval: escape },
      { wait: 500 },
    ]);
  return [
    job("home", "/?fixtures=normal", [
      { shot: "polish-home.png" },
      { eval: `document.querySelector('circle[aria-label="Open career-manager"]')?.focus(); 0` },
      { wait: 700 },
      { shot: "polish-hath-hover.png" },
    ]),
    job("thread", "/?fixtures=normal", [
      { eval: sidebarRow("finance-specialist") },
      { wait: 900 },
      { eval: emit({ type: "wake_started", agent_id: "finance-specialist", wake_id: "00000000-0000-4000-9000-000000000009", reason: { kind: "message", ref: null } }) },
      { wait: 900 },
      { shot: "polish-thread-pill.png" },
    ]),
    job("thread-edges", "/?fixtures=chat-rich", [
      { eval: sidebarRow("schedule-specialist") },
      { wait: 1200 },
      { eval: `(() => { const el = document.querySelector("aside .scroll.overflow-y-auto.overscroll-contain"); el.scrollTop = 1100; })(); 0` },
      { wait: 400 },
      { shot: "polish-thread-edges.png" },
    ]),
    job("day-1440", "/planner?view=day&fixtures=many", [{ shot: "polish-day-1440.png" }, { hover: "[role=radio][aria-checked=false]" }, { wait: 300 }, { shot: "polish-segmented-hover.png" }]),
    job("day-960", "/planner?view=day&fixtures=many", [{ shot: "polish-day-960.png" }], 960, 640),
    job("day-narrow", "/planner?view=day&fixtures=many", [{ shot: "polish-day-narrow.png" }], 700, 900),
    job("month", "/planner?view=month&fixtures=normal", [{ shot: "polish-month.png" }]),
    job("popover-1440", "/planner?view=day&fixtures=long", edges("1440", 1440, 900)),
    job("popover-960", "/planner?view=day&fixtures=long", edges("960", 960, 640), 960, 640),
    job("system", "/system?fixtures=normal", [{ shot: "polish-system.png" }]),
  ];
}

function plan(opts, outDir) {
  if (opts.polish) {
    return { outDir: join(outDir, "shots"), hookScript: join(here, "hook.js"), checksScript: join(here, "checks.js"), jobs: polishJobs() };
  }
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
        jobs.push({ name: tag, url: `${ORIGIN}${PAGES[page]}${PAGES[page].includes("?") ? "&" : "?"}fixtures=${scenario}`, width, height, settleMs: SETTLE_MS[scenario] ?? 4000, steps });
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
