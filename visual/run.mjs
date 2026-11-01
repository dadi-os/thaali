/**
 * The visual loop: serves Thaali against the fixture transport, captures every page in every
 * scenario and width in a WKWebView (the engine Tauri uses on macOS), runs the DOM checks on
 * each capture, and writes screenshots, results.json and report.md under `--out`.
 *
 * Usage: node visual/run.mjs --out <dir> [--pages hath,system] [--scenarios normal,asking]
 *        [--widths 1440,900x700,1080x1920] [--interact] [--flows]
 *
 * `--flows` adds the scripted flows (agent popover, toasts, System task rows, chat thread) at
 * 1440 wide in the `normal`, `asking` and `long` scenarios; `--flows-only` runs just those.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const PORT = 5174;
const ORIGIN = `http://127.0.0.1:${PORT}`;

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

async function serverUp() {
  try {
    return (await fetch(`${ORIGIN}/?fixtures=normal`)).ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverUp()) return null;
  const child = spawn("npx", ["vite", "--config", "vite.visual.config.ts"], { cwd: root, stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) {
    if (await serverUp()) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error("the vite visual server did not come up");
}

function ensureSnap() {
  const bin = join(here, ".build", "snap");
  const source = join(here, "snap.swift");
  if (!existsSync(bin) || statSync(bin).mtimeMs < statSync(source).mtimeMs) {
    mkdirSync(join(here, ".build"), { recursive: true });
    const built = spawnSync("swiftc", ["-O", source, "-o", bin], { stdio: "inherit" });
    if (built.status !== 0) throw new Error("swiftc failed to build the snapshot tool");
  }
  return bin;
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
const emit = (event) => `window.__fixtures.emit("hath", "/events", ${JSON.stringify({ ...event, at: "NOW" }).replace('"NOW"', "new Date().toISOString()")}); 0`;
const message = (seq, content) => ({ type: "message", agent_id: "finance-specialist", from_agent_id: "finance-specialist", to_agent_id: null, content, attachments: [], seq });

/** Scripted flows: each opens something, then captures its frames and runs the checks. */
function flowJobs(scenario) {
  const job = (name, route, steps, settleMs = 2500) => ({ name: `flow-${name}~${scenario}`, url: `${ORIGIN}${route}?fixtures=${scenario}`, width: 1440, height: 900, settleMs, steps });
  const frames = (tag, times) => times.flatMap((t, i) => [{ wait: i === 0 ? t : t - times[i - 1] }, { shot: `flow-${tag}~${scenario}~${t}ms.png` }]);
  return [
    job("agent-popover", "/hath", [
      { eval: sidebarRow("finance-specialist") },
      { wait: 900 },
      { shot: `flow-agent-thread~${scenario}.png` },
      { eval: "window.__mountSince = performance.now(); 0" },
      { click: '[aria-label$=" details"]' },
      ...frames("agent-popover-open", [80, 300, 900]),
      { checks: "popover-open" },
      { eval: '[...document.querySelectorAll("[aria-expanded=\'false\']")].slice(0, 2).forEach((b) => b.click()); 0' },
      ...frames("agent-popover-expand", [100, 400, 1000]),
      { checks: "popover-expanded" },
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
      { eval: "window.__mountSince = performance.now(); 0" },
      { eval: '[...document.querySelectorAll("button[aria-expanded]")].find((b) => b.textContent.includes("task/"))?.click(); 0' },
      ...frames("system-task-open", [100, 450, 1200]),
      { checks: "task-open" },
    ]),
    job("chat-thread", "/", [
      { eval: sidebarRow("finance-specialist") },
      ...frames("chat-open", [120, 600]),
      { checks: "thread" },
    ]),
  ];
}

function plan(opts, outDir) {
  const pages = opts["flows-only"] ? [] : list(opts.pages, Object.keys(PAGES));
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
  if (opts.flows || opts["flows-only"]) for (const scenario of ["normal", "asking", "long"]) jobs.push(...flowJobs(scenario));
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
  const bin = ensureSnap();
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
