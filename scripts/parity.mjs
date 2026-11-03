/**
 * Feature parity gate: every API call the baseline app made from its screens must still be made, unless a drop is approved.
 *
 * Usage: node scripts/parity.mjs [--base <rev>]    (default baseline: ea318d9, the app before the rebuild)
 *
 * A call is `client.method(` for each client src/shared/api/index.ts exports (chaavi, hath, nas, ...), found in src outside the api
 * layer, tests and the dev fixtures. A call in the baseline and not in the working tree fails unless scripts/parity-approved-drops.json
 * lists it with the reason it was approved.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const base = argv[0] === "--base" ? argv[1] : "ea318d9";

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (err.status === 1) {
      return "";
    }
    throw err;
  }
};

const clients = [...readFileSync(join(root, "src/shared/api/index.ts"), "utf8").matchAll(/^export let (\w+)!: \w+Client/gm)].map((match) => match[1]);
const call = new RegExp(`(?<![\\w.])(${clients.join("|")})\\.([a-zA-Z]+)\\(`, "g");
const SKIP = /^(src\/shared\/api\/|src\/dev\/)|\.test\.tsx?$/;

/** The `client.method` calls in the files `git grep` lists for `rev` (the working tree when null), with where each is made. */
function callsAt(rev) {
  const found = new Map();
  const args = ["grep", "-I", "--no-color", "-n", ...(rev === null ? ["--untracked"] : []), "-E", `(${clients.join("|")})\\.[a-zA-Z]+\\(`, ...(rev === null ? [] : [rev]), "--", "src"];
  for (const line of git(...args).split("\n")) {
    const parsed = rev === null ? line.match(/^([^:]+):(\d+):(.*)$/) : line.slice(rev.length + 1).match(/^([^:]+):(\d+):(.*)$/);
    if (parsed === null || SKIP.test(parsed[1])) {
      continue;
    }
    for (const hit of parsed[3].matchAll(call)) {
      const key = `${hit[1]}.${hit[2]}`;
      found.set(key, [...(found.get(key) ?? []), `${parsed[1]}:${parsed[2]}`]);
    }
  }
  return found;
}

const approved = JSON.parse(readFileSync(join(root, "scripts/parity-approved-drops.json"), "utf8"));
const before = callsAt(base);
const now = callsAt(null);
const dropped = [...before.keys()].filter((key) => !now.has(key)).sort();
const unlisted = dropped.filter((key) => approved[key] === undefined);
const stale = Object.keys(approved).filter((key) => now.has(key) || !before.has(key));

console.log(`parity vs ${base}: ${before.size} calls then, ${now.size} now, ${dropped.length} dropped, ${dropped.length - unlisted.length} approved`);
for (const key of stale) {
  console.log(`  note: ${key} is in the approved list but is not a drop`);
}
for (const key of unlisted) {
  console.log(`  DROPPED ${key}   (was ${before.get(key).slice(0, 3).join(", ")})`);
}
if (unlisted.length > 0) {
  console.log(`${unlisted.length} dropped call(s) are not approved: restore the feature, or list it in scripts/parity-approved-drops.json with the reason.`);
  process.exit(1);
}
