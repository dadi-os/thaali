/**
 * The fidelity gate: renders every case of the design (reference pages built by the design generator) and of
 * the app (src/dev/gallery) in a WKWebView at 2x, then compares the two. A case passes when no pixel differs
 * beyond the tolerance and the element trees match in structure, text, attributes, box and computed style, at
 * every frame it names. Exits 1 when any case fails.
 *
 * Usage: DESIGN_REF_DIR=<design site dir> node visual/fidelity/run.mjs --out <dir> [--cases button.,badge.working] [--shards 4]
 *
 * A `pending` case (a page not yet rebuilt) runs only when `--cases` names it.
 *
 * A case may also be a whole `page`: `appPath` is the app route to load (with its `?fixtures=` scenario), and `root` names
 * the element to compare on each side (`{ design: ".app", app: "#root > div" }`).
 *
 * A case may carry `force` (pointer and focus states to put on elements), `toggle` (classes to add, or remove with a third element "remove", starting a
 * transition) and `times` (ms at which to compare frames); see gen/gate.mjs in the design generator.
 *
 * `DESIGN_REF_DIR` is required: the generator's `site/` directory, holding `gate/manifest.json`, `gate/<case>.html`
 * and `fonts/`. `--cases` takes case ids or id prefixes; `--shards` (default 4) is how many snapshot tools run at once. The output directory gets `report.json` and `report.md`,
 * and for every case the design, app and heatmap images (every failing frame in full, passing ones as the design shot).
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareTrees } from "./compare.mjs";
import { ensureServer, ensureTool, ORIGIN, serveDir } from "../harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REF_PORT = 5290;
const REF_ORIGIN = `http://127.0.0.1:${REF_PORT}`;
/** Zones whose rules match the design's pinned America/New_York. */
const DESIGN_ZONES = ["America/New_York", "America/Detroit"];

/** Parses `--key value` pairs; `--out` is required. */
function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error(`unexpected argument ${argv[i]}`);
    out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  if (typeof out.out !== "string") throw new Error("--out <dir> is required");
  return out;
}

/** The design generator's site directory, from the required `DESIGN_REF_DIR`. */
function requireDesignDir() {
  const dir = process.env.DESIGN_REF_DIR;
  if (!dir) throw new Error("DESIGN_REF_DIR is required: the design generator's site/ directory");
  return resolve(dir);
}

/** The plan for one side of one case: load, prepare, optionally force a state, then shoot and extract each frame. */
function sideJob(side, c, url) {
  const steps = [];
  const evalIndex = [];
  const addEval = (code) => {
    evalIndex.push(steps.length);
    steps.push({ eval: code });
    return evalIndex.length - 1;
  };
  const frames = c.times ?? [null];
  addEval(`window.__ds.prepare(${JSON.stringify({ width: c.width, height: c.height, root: c.root?.[side] ?? null, page: c.page === true })})`);
  steps.push({ wait: 150 });
  addEval("window.__ds.finish()");
  const force = c.force.length > 0 ? addEval(`window.__ds.force(${JSON.stringify(c.force)})`) : null;
  if (c.toggle.length > 0) {
    addEval(`window.__ds.addClass(${JSON.stringify(c.toggle)})`);
  }
  const shots = frames.map((time) => {
    if (time === null) {
      addEval("window.__ds.finish()");
    } else {
      addEval(`window.__ds.seek(${time})`);
    }
    const file = `${side}~${c.id}~${time ?? "end"}.png`;
    steps.push({ shot: file });
    return { time, file, tree: addEval("window.__ds.extract()") };
  });
  return { job: { name: `${side}~${c.id}`, url, width: c.w, height: c.h, settleMs: side === "app" ? 1800 : 500, steps }, shots, force };
}

/** Runs the Swift pixel comparison of two screenshots and returns its JSON: sizes, differing pixel count, percent and the largest channel delta. */
function pixelDiff(pixeldiff, design, app, heat, tolerance) {
  const run = spawnSync(pixeldiff, [design, app, heat, String(tolerance)], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`pixeldiff failed: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

/** The Markdown report: a row per case frame, then the first differences of each failing one. */
function summarise(results, config) {
  const lines = ["# Fidelity report", "", `${results.filter((r) => r.pass).length} of ${results.length} case frames pass.`, "", "| case | frame | pixels | dom diffs | verdict |", "|---|---|---|---|---|"];
  for (const r of results) {
    lines.push(`| ${r.id} | ${r.time ?? "end"} | ${r.pixels.sizeMismatch ? "size" : `${r.pixels.percent.toFixed(3)}%`} | ${r.diffs.length} | ${r.pass ? "PASS" : "FAIL"} |`);
  }
  for (const r of results.filter((x) => !x.pass)) {
    lines.push("", `## ${r.id} @ ${r.time ?? "end"}`, "");
    for (const d of r.diffs.slice(0, config.reportLimit)) lines.push(`- \`${d.path}\` ${d.kind} **${d.prop}**: design \`${d.design}\` · app \`${d.app}\``);
    if (r.diffs.length > config.reportLimit) lines.push(`- … ${r.diffs.length - config.reportLimit} more in report.json`);
  }
  return lines.join("\n");
}

const opts = args();
const designDir = requireDesignDir();
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (!DESIGN_ZONES.includes(zone)) {
  throw new Error(`the design pins America/New_York; this machine is in ${zone}`);
}
const config = JSON.parse(readFileSync(join(here, "thresholds.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(designDir, "gate", "manifest.json"), "utf8"));
const wanted = typeof opts.cases === "string" ? opts.cases.split(",") : null;
const cases = manifest.map((c) => ({ force: [], toggle: [], width: null, height: null, ...c })).filter((c) => (wanted === null ? c.pending !== true : wanted.some((w) => c.id === w || c.id.startsWith(w))));
if (cases.length === 0) throw new Error("no case matches --cases");

const outDir = resolve(opts.out);
mkdirSync(join(outDir, "shots"), { recursive: true });
const refServer = await serveDir(designDir, REF_PORT);
const devServer = await ensureServer();
try {
  const snap = ensureTool("snap.swift", "snap");
  const pixeldiff = ensureTool("fidelity/pixeldiff.swift", "pixeldiff");
  const plans = cases.flatMap((c) => {
    const clock = c.clock ? `&__clock=${encodeURIComponent(c.clock)}` : "";
    return [
      { side: "design", c, ...sideJob("design", c, `${REF_ORIGIN}/gate/${c.id}.html?${clock.slice(1)}`) },
      { side: "app", c, ...sideJob("app", c, c.appPath ? `${ORIGIN}${c.appPath}${clock}` : `${ORIGIN}/?fixtures=normal&gallery=${encodeURIComponent(c.id)}${clock}`) },
    ];
  });
  const shards = Math.max(1, Number(opts.shards ?? 4));
  const shotsDir = join(outDir, "shots");
  const jobs = plans.map((p) => p.job);
  const slices = Array.from({ length: shards }, (_, s) => jobs.filter((_, i) => Math.floor(i / 2) % shards === s));
  const runs = slices.map((slice, s) => {
    const planFile = join(outDir, `plan-${s}.json`);
    const resultsFile = join(outDir, `snap-results-${s}.json`);
    writeFileSync(planFile, JSON.stringify({ outDir: shotsDir, hookScript: join(here, "hook.js"), checksScript: join(here, "..", "checks.js"), jobs: slice }, null, 1));
    return new Promise((done, fail) => {
      spawn(snap, [planFile, resultsFile], { stdio: "inherit" }).on("close", (status) => (status === 0 ? done(JSON.parse(readFileSync(resultsFile, "utf8"))) : fail(new Error(`snapshot tool exited ${status}`))));
    });
  });
  const sliceResults = await Promise.all(runs);
  const cursor = sliceResults.map(() => 0);
  const snapResults = jobs.map((_, i) => {
    const s = Math.floor(i / 2) % shards;
    return sliceResults[s][cursor[s]++];
  });
  const plan = { outDir: shotsDir };
  const results = [];
  for (let i = 0; i < plans.length; i += 2) {
    const [design, app] = [plans[i], plans[i + 1]];
    const [dr, ar] = [snapResults[i], snapResults[i + 1]];
    for (let f = 0; f < design.shots.length; f++) {
      const d = design.shots[f];
      const a = app.shots[f];
      const dTree = dr.evals[d.tree];
      const aTree = ar.evals[a.tree];
      const errors = [...dr.errors, ...ar.errors].filter((e) => !/vite|\[hmr\]/i.test(e));
      let diffs;
      if (typeof dTree !== "string" || typeof aTree !== "string" || dTree.startsWith("ERR") || aTree.startsWith("ERR")) {
        diffs = [{ path: "", kind: "render", prop: "extract", design: String(dTree).slice(0, 160), app: String(aTree).slice(0, 160) }];
      } else {
        diffs = compareTrees(JSON.parse(dTree), JSON.parse(aTree), config);
      }
      const heat = join(outDir, "shots", `heat~${design.c.id}~${d.time ?? "end"}.png`);
      const pixels = typeof dTree === "string" && typeof aTree === "string" && !dTree.startsWith("ERR") && !aTree.startsWith("ERR")
        ? pixelDiff(pixeldiff, join(plan.outDir, d.file), join(plan.outDir, a.file), heat, config.channelTolerance)
        : { sizeMismatch: true, percent: 100 };
      const pass = !pixels.sizeMismatch && pixels.percent <= config.maxDifferingPercent && diffs.length === 0 && errors.length === 0;
      results.push({ id: design.c.id, time: d.time, pass, pixels, diffs, errors });
    }
  }
  writeFileSync(join(outDir, "report.json"), JSON.stringify({ config, results }, null, 1));
  writeFileSync(join(outDir, "report.md"), summarise(results, config));
  for (const r of results.filter((x) => !x.pass)) {
    const stem = `${r.id}~${r.time ?? "end"}`;
    mkdirSync(join(outDir, "failures"), { recursive: true });
    copyFileSync(join(outDir, "shots", `design~${stem}.png`), join(outDir, "failures", `design~${stem}.png`));
    copyFileSync(join(outDir, "shots", `app~${stem}.png`), join(outDir, "failures", `app~${stem}.png`));
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`${results.length - failed} of ${results.length} case frames pass; report at ${join(outDir, "report.md")}`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  refServer.close();
  if (devServer) process.kill(-devServer.pid);
}
